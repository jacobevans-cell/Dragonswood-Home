"use strict";

const Core=require("./home-visual-auth-core");

function createHomeVisualAuth({onCall,HttpsError,admin,db,FieldValue,Timestamp,teacherEmail}){
  const visualCollection=db.collection("homeVisualLogins");
  const teacher=String(teacherEmail||"").trim().toLowerCase();
  const teacherOnly=request=>{
    if(!request.auth)throw new HttpsError("unauthenticated","Grown-up sign-in is required.");
    if(String(request.auth.token?.email||"").trim().toLowerCase()!==teacher)throw new HttpsError("permission-denied","This account cannot change family sign-in settings.");
  };
  const validChoice=(value,allowed,label)=>{
    const id=String(value||"").trim().toLowerCase();
    if(!allowed.includes(id))throw new HttpsError("invalid-argument",`Choose a valid ${label}.`);
    return id;
  };
  const learningLevel=value=>Math.max(0,Math.min(4,Math.floor(Number(value)||0)));

  const listHomeVisualProfiles=onCall({region:"us-central1",timeoutSeconds:10,memory:"256MiB",maxInstances:10},async request=>{
    const snapshot=await visualCollection.get();
    const activeDocs=snapshot.docs.filter(doc=>doc.data()?.active===true);
    const profiles=activeDocs.map(doc=>Core.publicProfile(doc.id,doc.data()));
    const isParent=String(request.auth?.token?.email||"").trim().toLowerCase()===teacher;
    if(isParent){
      const studentSnapshots=await Promise.all(activeDocs.map(row=>db.doc(`students/${String(row.data()?.uid||"")}`).get()));
      studentSnapshots.forEach((studentSnapshot,index)=>{
        const data=studentSnapshot.exists?studentSnapshot.data():{},grade=Math.max(0,Math.min(4,Math.floor(Number(data.grade)||0)));
        profiles[index]={...profiles[index],grade,learningLevels:{math:Math.max(0,Math.min(4,Math.floor(Number(data.learningLevels?.math??grade)))),reading:Math.max(0,Math.min(4,Math.floor(Number(data.learningLevels?.reading??grade)))),writing:Math.max(0,Math.min(4,Math.floor(Number(data.learningLevels?.writing??grade)))),science:Math.max(0,Math.min(4,Math.floor(Number(data.learningLevels?.science??grade))))},supportPreferences:{calmMode:data.supportPreferences?.calmMode!==false,readAloud:data.supportPreferences?.readAloud!==false}};
      });
    }
    profiles.sort((a,b)=>a.sortOrder-b.sortOrder||a.nickname.localeCompare(b.nickname));
    return {profiles};
  });

  const homeVisualSignIn=onCall({region:"us-central1",timeoutSeconds:15,memory:"256MiB",maxInstances:10},async request=>{
    const profileId=Core.profileId(request.data?.profileId),colorId=validChoice(request.data?.colorId,Core.COLOR_IDS,"color"),animalId=validChoice(request.data?.animalId,Core.ANIMAL_IDS,"animal");
    if(!profileId)throw new HttpsError("invalid-argument","Choose a family profile.");
    const ref=visualCollection.doc(profileId),now=Date.now();
    const result=await db.runTransaction(async tx=>{
      const snapshot=await tx.get(ref);
      if(!snapshot.exists||snapshot.data()?.active!==true)return {outcome:"mismatch"};
      const data=snapshot.data(),lockedUntilMs=Number(data.lockedUntil?.toMillis?.()||0);
      const decision=Core.attemptDecision({matches:Core.verifySecret(colorId,animalId,data.secretSalt,data.secretHash),failedAttempts:data.failedAttempts,lockedUntilMs,now});
      if(decision.outcome==="locked"){
        if(lockedUntilMs<=now)tx.set(ref,{failedAttempts:0,lockedUntil:Timestamp.fromMillis(now+decision.waitMs),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        return {outcome:"locked",waitSeconds:Math.max(1,Math.ceil(decision.waitMs/1000))};
      }
      if(decision.outcome==="mismatch"){
        tx.set(ref,{failedAttempts:decision.failedAttempts,lockedUntil:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        return {outcome:"mismatch"};
      }
      tx.set(ref,{failedAttempts:0,lockedUntil:FieldValue.delete(),lastLoginAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return {outcome:"success",uid:String(data.uid||"")};
    });
    if(result.outcome==="locked")throw new HttpsError("resource-exhausted","Too many tries. Take a 10-minute break, then try again.",{retryAfterSeconds:result.waitSeconds});
    if(result.outcome!=="success"||!result.uid)throw new HttpsError("invalid-argument","That color and animal did not match. Try again.");
    const member=await db.doc(`familyMembers/${result.uid}`).get();
    if(!member.exists||member.data()?.role!=="child"||member.data()?.active!==true)throw new HttpsError("permission-denied","This family profile is paused. Ask a grown-up for help.");
    const token=await admin.auth().createCustomToken(result.uid,{dragonswoodHomeChild:true});
    return {token};
  });

  const configureHomeVisualProfile=onCall({region:"us-central1",timeoutSeconds:20,memory:"256MiB",maxInstances:4},async request=>{
    teacherOnly(request);
    const input=request.data||{},profileId=Core.profileId(input.profileId);
    if(!profileId)throw new HttpsError("invalid-argument","Use a short profile ID made from letters, numbers, and hyphens.");
    const nickname=String(input.nickname||"").trim().replace(/\s+/g," ").slice(0,24);
    if(!nickname)throw new HttpsError("invalid-argument","Enter the child's preferred display name.");
    const avatarId=validChoice(input.avatarId,Core.AVATAR_IDS,"profile picture"),colorId=validChoice(input.colorId,Core.COLOR_IDS,"color"),animalId=validChoice(input.animalId,Core.ANIMAL_IDS,"animal");
    const grade=learningLevel(input.grade),sortOrder=Math.max(0,Math.min(99,Math.floor(Number(input.sortOrder)||0)));
    const learningLevels={math:learningLevel(input.learningLevels?.math??grade),reading:learningLevel(input.learningLevels?.reading??grade),writing:learningLevel(input.learningLevels?.writing??grade),science:learningLevel(input.learningLevels?.science??grade)};
    const supportPreferences={calmMode:input.supportPreferences?.calmMode!==false,readAloud:input.supportPreferences?.readAloud!==false};
    const existing=await visualCollection.doc(profileId).get(),uid=String(existing.data()?.uid||`home-child-${profileId}`).slice(0,128);
    try{await admin.auth().getUser(uid)}catch(error){if(error?.code==="auth/user-not-found")await admin.auth().createUser({uid,displayName:nickname,disabled:false});else throw error}
    await admin.auth().updateUser(uid,{displayName:nickname,disabled:false});
    const secretSalt=Core.newSalt(),secretHash=Core.hashSecret(colorId,animalId,secretSalt),batch=db.batch();
    batch.set(visualCollection.doc(profileId),{uid,nickname,avatarId,sortOrder,active:true,secretVersion:1,secretSalt,secretHash,failedAttempts:0,lockedUntil:null,updatedBy:request.auth.uid,updatedAt:FieldValue.serverTimestamp(),createdAt:existing.exists?(existing.data().createdAt||FieldValue.serverTimestamp()):FieldValue.serverTimestamp()},{merge:false});
    batch.set(db.doc(`familyMembers/${uid}`),{role:"child",active:true,profileId,nickname,updatedBy:request.auth.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    batch.set(db.doc(`students/${uid}`),{firstName:nickname,displayName:nickname,grade,learningLevels,supportPreferences,learningRangeMinGrade:0,learningRangeMaxGrade:4,avatar:avatarId,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    await batch.commit();
    return {profile:Core.publicProfile(profileId,{nickname,avatarId,sortOrder}),uid};
  });

  return {listHomeVisualProfiles,homeVisualSignIn,configureHomeVisualProfile};
}

module.exports={createHomeVisualAuth};
