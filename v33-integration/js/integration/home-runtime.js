(function(){
  'use strict';

  const Core=window.DWV33Core;
  if(!Core)throw new Error('The Dragonswood core must load before the Home runtime.');

  const FIREBASE_CONFIG=window.DRAGONSWOOD_HOME_FIREBASE_CONFIG;
  const VERSION='home-family-1';
  const environment='production';
  const localPreview=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('preview')==='1';
  const controllers=[];
  let sdkPromise=null;

  function emit(callback,payload){
    try{callback?.(Object.freeze({...payload,environment,version:VERSION}))}
    catch(error){console.error('[Dragonswood Home callback]',error)}
  }

  function sdk(){
    sdkPromise ||= Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js')
    ]).then(([app,auth,firestore,functions])=>({app,auth,firestore,functions}));
    return sdkPromise;
  }

  function studentModel(user,profile={}){
    const firstName=String(profile.firstName||profile.displayName||user.displayName||'Adventurer').trim();
    const xp=Math.max(0,Number(profile.xp)||0),level=Math.max(1,Number(profile.level)||Math.floor(xp/200)+1),floor=(level-1)*200,next=level*200;
    return Object.freeze({
      id:user.uid,
      firstName,
      displayName:String(profile.displayName||firstName),
      initial:firstName.slice(0,1).toUpperCase()||'A',
      grade:String(Number.isFinite(Number(profile.grade))?Number(profile.grade):2),
      learningLevels:Object.freeze({...profile.learningLevels}),
      supportPreferences:Object.freeze({...profile.supportPreferences}),
      level,
      hp:Math.max(0,Number(profile.hp)||10),
      gold:Math.max(0,Number(profile.gold)||0),
      streak:Math.max(0,Number(profile.streak)||0),
      xp,
      xpFloor:floor,
      xpNext:next,
      xpPct:Math.max(0,Math.min(100,Math.round((xp-floor)/Math.max(1,next-floor)*100))),
      classLabel:'Home Adventurer',
      petName:String(profile.activePet||'Choose a companion'),
      equipped:profile.equipped||{},
      inventory:Array.isArray(profile.inventory)?profile.inventory:[],
      narrationVoice:String(profile.narrationVoice||'automatic'),
      spellingGrade:Math.max(1,Math.min(4,Number(profile.learningLevels?.reading??profile.grade)||2)),
      dailyAccessUnlocked:true,
      morningWorkComplete:true,
      dailyAccessOverride:true,
      dailyMissions:Object.freeze({dateKey:Core.phoenixDateKey(),morning:'complete'})
    });
  }

  async function startStudent(onUpdate){
    emit(onUpdate,{status:'loading',message:'Opening your family portal…'});
    if(localPreview){
      const user={uid:'local-preview-child',displayName:'Home Adventurer'},profile={firstName:'Home',displayName:'Home Adventurer',grade:2,learningLevels:{math:2,reading:2,writing:3,science:3},supportPreferences:{calmMode:true,readAloud:true},xp:120,gold:8};
      const controller={environment,async listVisualProfiles(){return[]},async signInWithVisualSecret(){return true},async signOut(){return true},async recordReadingActivity(){return true},async reportSpellingMission(){return true},async saveWriting(){return true},async submitWriting(){return true},async requestWritingFeedback(){return{feedback:{celebration:'You made the tiny door easy to picture.',nextStep:'Add one detail about what the character hears.',tryThis:'I heard…',grownUpNote:''},cached:false}},dispose(){}};
      controllers.push(controller);queueMicrotask(()=>emit(onUpdate,{status:'authorized',user,student:studentModel(user,profile),academic:Object.freeze({scribe:null,reading:Object.freeze({rows:[],targetMinutes:15,assignedDateKeys:[],targetsByDate:{}})}),world:null,curriculumAccess:Object.freeze({unlocked:true}),spelling:Object.freeze({grade:2,results:[],completeToday:false}),homeEdition:true}));return controller;
    }
    let F;
    try{
      const S=await sdk();
      let firebaseApp;
      try{firebaseApp=S.app.getApp()}catch{firebaseApp=S.app.initializeApp(FIREBASE_CONFIG)}
      F={S,auth:S.auth.getAuth(firebaseApp),db:S.firestore.getFirestore(firebaseApp),functions:S.functions.getFunctions(firebaseApp,'us-central1')};
    }catch(error){
      emit(onUpdate,{status:'error',message:`Home Firebase could not load: ${error?.message||error}`});
      return {environment,dispose(){}};
    }

    const {S,auth,db,functions}=F;
    let profileUnsub=null,currentUser=null;
    const clear=()=>{try{profileUnsub?.()}catch{}profileUnsub=null};

    const controller={
      environment,
      async listVisualProfiles(){
        const call=S.functions.httpsCallable(functions,'listHomeVisualProfiles'),result=await call({});
        return Array.isArray(result?.data?.profiles)?result.data.profiles:[];
      },
      async signInWithVisualSecret(input={}){
        const call=S.functions.httpsCallable(functions,'homeVisualSignIn');
        const result=await call({profileId:String(input.profileId||''),colorId:String(input.colorId||''),animalId:String(input.animalId||'')});
        const token=String(result?.data?.token||'');
        if(!token)throw new Error('The family sign-in token was not returned.');
        return S.auth.signInWithCustomToken(auth,token);
      },
      async signOut(){return S.auth.signOut(auth)},
      async recordReadingActivity(){return true},
      async reportSpellingMission(){return true},
      async saveWriting(){return true},
      async submitWriting(){return true},
      async requestWritingFeedback(input={}){
        if(!currentUser)throw new Error('Choose your family profile first.');
        const call=S.functions.httpsCallable(functions,'coachHomeWriting');
        const result=await call({prompt:String(input.prompt||'').slice(0,1200),responseText:String(input.responseText||'').slice(0,6000)});
        return result?.data||{};
      },
      dispose(){clear();try{authUnsub()}catch{}}
    };

    const authUnsub=S.auth.onAuthStateChanged(auth,async user=>{
      clear();currentUser=user||null;
      if(!user){emit(onUpdate,{status:'signed-out',message:'Choose your picture to begin.'});return}
      emit(onUpdate,{status:'checking',user,message:'Opening your family profile…'});
      try{
        const memberSnap=await S.firestore.getDoc(S.firestore.doc(db,'familyMembers',user.uid));
        const member=memberSnap.exists()?memberSnap.data():{};
        if(member.role!=='child'||member.active!==true){
          emit(onUpdate,{status:'unauthorized',user,message:'This family profile is paused. Ask a grown-up for help.'});return;
        }
        profileUnsub=S.firestore.onSnapshot(S.firestore.doc(db,'students',user.uid),snapshot=>{
          const profile=snapshot.exists()?snapshot.data():{};
          emit(onUpdate,{
            status:'authorized',
            user,
            student:studentModel(user,profile),
            academic:Object.freeze({scribe:null,reading:Object.freeze({rows:[],targetMinutes:15,assignedDateKeys:[],targetsByDate:{}})}),
            world:null,
            curriculumAccess:Object.freeze({unlocked:true}),
            spelling:Object.freeze({grade:Math.max(1,Math.min(4,Number(profile.learningLevels?.reading??profile.grade)||2)),results:[],completeToday:false}),
            homeEdition:true
          });
        },error=>emit(onUpdate,{status:'error',user,message:`Your profile could not load: ${error?.code||error?.message||error}`}));
      }catch(error){emit(onUpdate,{status:'error',user,message:`Family authorization failed: ${error?.code||error?.message||error}`})}
    });

    controllers.push(controller);
    return controller;
  }

  window.addEventListener('pagehide',()=>controllers.splice(0).forEach(controller=>{try{controller.dispose()}catch{}}),{once:true});
  window.DWV33Integration=Object.freeze({version:VERSION,environment,firebaseConfigured:true,startStudent,core:Core,homeEdition:true});
})();
