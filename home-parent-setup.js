const config=window.DRAGONSWOOD_HOME_FIREBASE_CONFIG||{};
const configured=!!config.projectId&&!String(config.projectId).includes('not-configured')&&!!config.apiKey&&!String(config.apiKey).startsWith('HOME_FIREBASE_');
const localPreview=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('preview')==='1';
const statusNode=document.querySelector('[data-parent-status]');
const signInButton=document.querySelector('[data-parent-signin]');
const signOutButton=document.querySelector('[data-parent-signout]');
const setupSection=document.querySelector('[data-profile-setup]');
const formsRoot=document.querySelector('[data-profile-forms]');
const slots=Object.freeze([
  Object.freeze({id:'child-one',label:'First adventurer',avatarId:'nyx',sortOrder:1,grade:2}),
  Object.freeze({id:'child-two',label:'Second adventurer',avatarId:'ember',sortOrder:2,grade:3})
]);
const colors=Object.freeze([['blue','Blue'],['green','Green'],['purple','Purple'],['orange','Orange'],['pink','Pink'],['yellow','Yellow']]);
const animals=Object.freeze([['fox','🦊 Fox'],['owl','🦉 Owl'],['bear','🐻 Bear'],['rabbit','🐰 Rabbit'],['turtle','🐢 Turtle'],['fish','🐟 Fish']]);
const avatars=Object.freeze([['nyx','Nyx — purple dragon'],['ember','Ember — orange dragon'],['mochi','Mochi — mushroom friend'],['blink','Blink — one-eyed friend']]);
let sdk=null,auth=null,functions=null,profileById=new Map();

function setStatus(message,tone=''){
  statusNode.textContent=message;statusNode.dataset.tone=tone;
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function options(rows,selected=''){return rows.map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('')}
function gradeOptions(selected){return [[0,'Kindergarten'],[1,'Grade 1'],[2,'Grade 2'],[3,'Grade 3'],[4,'Grade 4']].map(([value,label])=>`<option value="${value}" ${Number(selected)===value?'selected':''}>${label}</option>`).join('')}
function learningLevelOptions(selected){return [[0,'Kindergarten skills'],[1,'Grade 1 skills'],[2,'Grade 2 skills'],[3,'Grade 3 skills'],[4,'Grade 4 skills']].map(([value,label])=>`<option value="${value}" ${Number(selected)===value?'selected':''}>${label}</option>`).join('')}
function avatarPath(id){return `v33-integration/assets/art/pet-${['nyx','ember','mochi','blink'].includes(id)?id:'nyx'}.jpg`}
function renderForms(){
  formsRoot.innerHTML=slots.map(slot=>{
    const existing=profileById.get(slot.id)||{},avatarId=existing.avatarId||slot.avatarId,grade=Number.isFinite(Number(existing.grade))?Number(existing.grade):slot.grade,levels=existing.learningLevels||{},supports=existing.supportPreferences||{};
    return `<form class="panel home-profile-form" data-profile-form="${slot.id}">
      <div class="home-form-title"><img data-avatar-preview src="${avatarPath(avatarId)}" alt=""><div><div class="eyebrow">${slot.label}</div><h3>${escapeHtml(existing.nickname||'New adventurer')}</h3></div></div>
      <label>Preferred name or nickname<input name="nickname" maxlength="24" autocomplete="off" required value="${escapeHtml(existing.nickname||'')}"></label>
      <label>Profile picture<select name="avatarId">${options(avatars,avatarId)}</select></label>
      <label>School grade<select name="grade">${gradeOptions(grade)}</select></label>
      <fieldset class="home-learning-levels"><legend>Learning level for each subject</legend><p>These may be different from school grade and from each other.</p><div>
        <label>Math<select name="mathLevel">${learningLevelOptions(levels.math??grade)}</select></label>
        <label>Reading<select name="readingLevel">${learningLevelOptions(levels.reading??grade)}</select></label>
        <label>Writing<select name="writingLevel">${learningLevelOptions(levels.writing??grade)}</select></label>
        <label>Science<select name="scienceLevel">${learningLevelOptions(levels.science??grade)}</select></label>
      </div></fieldset>
      <fieldset class="home-supports"><legend>Learning supports</legend><p class="home-form-help">🌿 Calm mode is always on: no countdowns, lost points, or penalty language.</p><label><input name="readAloud" type="checkbox" ${supports.readAloud===false?'':'checked'}> Show read-aloud controls</label></fieldset>
      <div class="home-secret-fields"><label>Secret color<select name="colorId" required><option value="">Choose a color…</option>${options(colors)}</select></label><label>Secret animal<select name="animalId" required><option value="">Choose an animal…</option>${options(animals)}</select></label></div>
      <p class="home-form-help">For privacy, saved secrets are never shown again. Choose both whenever you create or reset this profile.</p>
      <button class="btn btn-primary w-full" type="submit">${existing.id?'Reset and save':'Create child sign-in'}</button>
      <p class="home-form-result" data-form-result role="status" aria-live="polite"></p>
    </form>`;
  }).join('');
  formsRoot.querySelectorAll('[name="avatarId"]').forEach(select=>select.addEventListener('change',()=>{select.closest('form').querySelector('[data-avatar-preview]').src=avatarPath(select.value)}));
  formsRoot.querySelectorAll('[data-profile-form]').forEach((form,index)=>form.addEventListener('submit',event=>saveProfile(event,slots[index])));
}
async function loadSdk(){
  if(sdk)return sdk;
  const [appModule,authModule,functionsModule]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js')
  ]);
  const app=appModule.initializeApp(config,'DragonswoodHomeParentSetup');
  auth=authModule.getAuth(app);functions=functionsModule.getFunctions(app,'us-central1');
  try{await authModule.setPersistence(auth,authModule.browserSessionPersistence)}catch{}
  sdk={appModule,authModule,functionsModule};
  authModule.onAuthStateChanged(auth,user=>{
    const signedIn=!!user;signInButton.hidden=signedIn;signOutButton.hidden=!signedIn;setupSection.hidden=!signedIn;
    if(signedIn){setStatus(`Signed in as ${user.email||user.displayName||'parent'}.`,'success');loadProfiles()}
    else setStatus('Sign in with the authorized parent Google account to continue.');
  });
  return sdk;
}
async function loadProfiles(){
  try{
    const call=sdk.functionsModule.httpsCallable(functions,'listHomeVisualProfiles'),result=await call({}),profiles=Array.isArray(result?.data?.profiles)?result.data.profiles:[];
    profileById=new Map(profiles.map(profile=>[profile.id,profile]));renderForms();
  }catch(error){setStatus(error?.message||'Family profiles could not load.','error');renderForms()}
}
async function saveProfile(event,slot){
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),resultNode=form.querySelector('[data-form-result]'),data=new FormData(form);
  button.disabled=true;resultNode.textContent='Saving securely…';
  try{
    const call=sdk.functionsModule.httpsCallable(functions,'configureHomeVisualProfile'),result=await call({profileId:slot.id,nickname:data.get('nickname'),avatarId:data.get('avatarId'),grade:Number(data.get('grade')),learningLevels:{math:Number(data.get('mathLevel')),reading:Number(data.get('readingLevel')),writing:Number(data.get('writingLevel')),science:Number(data.get('scienceLevel'))},supportPreferences:{calmMode:true,readAloud:data.get('readAloud')==='on'},colorId:data.get('colorId'),animalId:data.get('animalId'),sortOrder:slot.sortOrder});
    profileById.set(slot.id,result.data.profile);resultNode.textContent='Saved. This child can use the picture sign-in now.';resultNode.dataset.tone='success';form.reset();await loadProfiles();
  }catch(error){resultNode.textContent=error?.message||'This profile could not save.';resultNode.dataset.tone='error'}
  finally{button.disabled=false}
}

renderForms();
if(localPreview){signInButton.hidden=true;signOutButton.hidden=true;setupSection.hidden=false;setStatus('Local grown-up preview. Saving is disabled in this preview.','warning');formsRoot.querySelectorAll('button[type="submit"]').forEach(button=>button.disabled=true)}
else if(!configured){signInButton.disabled=true;setStatus('Connect the separate Dragonswood Home Firebase project first. This page is ready but cannot save yet.','warning')}
else{loadSdk().catch(error=>setStatus(error?.message||'Firebase could not load.','error'))}
signInButton.addEventListener('click',async()=>{try{const S=await loadSdk(),provider=new S.authModule.GoogleAuthProvider();await S.authModule.signInWithPopup(auth,provider)}catch(error){setStatus(error?.message||'Google sign-in did not open.','error')}});
signOutButton.addEventListener('click',async()=>{try{await sdk.authModule.signOut(auth)}catch(error){setStatus(error?.message||'Sign-out failed.','error')}});
