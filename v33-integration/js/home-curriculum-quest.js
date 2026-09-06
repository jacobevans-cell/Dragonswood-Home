import{getApp,getApps,initializeApp}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import{getAuth,onAuthStateChanged}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import{collection,doc,getDoc,getDocs,getFirestore,serverTimestamp,setDoc}from'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const Curriculum=globalThis.DWHomeCurriculum;
const config=globalThis.DRAGONSWOOD_HOME_FIREBASE_CONFIG||{};
const LOCAL_PREVIEW=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('preview')==='1';
const nodes={
  childName:document.querySelector('[data-child-name]'),status:document.querySelector('[data-status]'),subjectView:document.querySelector('[data-subject-view]'),subjectGrid:document.querySelector('[data-subject-grid]'),completeCount:document.querySelector('[data-complete-count]'),lessonView:document.querySelector('[data-lesson-view]'),lessonLevel:document.querySelector('[data-lesson-level]'),lessonIcon:document.querySelector('[data-lesson-icon]'),lessonSubject:document.querySelector('[data-lesson-subject]'),lessonTitle:document.querySelector('[data-lesson-title]'),lessonGoal:document.querySelector('[data-lesson-goal]'),stepPanel:document.querySelector('[data-step-panel]'),breakOverlay:document.querySelector('[data-break-overlay]')
};
const state={uid:'',name:'adventurer',student:null,levels:{math:0,reading:0,writing:0,science:0},readAloud:true,completed:new Set(),subject:'',lesson:null,step:'learn',questionIndex:0,answers:{},feedback:null,showResponse:'',db:null};

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function phoenixDateKey(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function daySeed(subject){return Number(phoenixDateKey().replaceAll('-',''))+Math.max(0,Curriculum.SUBJECTS.findIndex(row=>row.id===subject))*7}
function levelName(level){return Curriculum.LEVEL_NAMES[Curriculum.clampLevel(level)]}
function setStatus(message,tone=''){nodes.status.textContent=message;nodes.status.dataset.tone=tone}
function setRoutine(step=''){
  document.querySelectorAll('[data-routine]').forEach(node=>node.classList.toggle('active',node.dataset.routine===step));
}
function localKey(subject){return `dragonswood-home-learning:${state.uid}:${phoenixDateKey()}:${subject}`}
function currentProgress(status=state.step==='complete'?'complete':'in-progress'){
  const answers=Object.fromEntries(Object.entries(state.answers).map(([key,value])=>[key,Number(value)]));
  const correctCount=state.lesson.questions.reduce((count,question,index)=>count+(answers[`q${index}`]===question.answer?1:0),0);
  return{studentId:state.uid,subject:state.subject,level:state.levels[state.subject],lessonId:state.lesson.id,status,step:state.step,learned:state.step!=='learn',answers,correctCount,showResponse:String(state.showResponse||'').slice(0,3000),dateKey:phoenixDateKey()};
}
async function saveProgress(status){
  if(!state.uid||!state.lesson)return;
  const progress=currentProgress(status),stored={...progress,savedAtMs:Date.now()};
  try{localStorage.setItem(localKey(state.subject),JSON.stringify(stored))}catch{}
  if(!state.db)return;
  try{
    const payload={...progress,completedAt:status==='complete'?serverTimestamp():null,updatedAt:serverTimestamp()};
    await setDoc(doc(state.db,'students',state.uid,'homeLearningProgress',`${state.subject}__${state.lesson.id}`),payload,{merge:false});
  }catch(error){console.warn('[Home Learning Paths save]',error);setStatus('Saved on this device. Cloud save will try again next time.','error')}
}
function notifyPortal(){
  const count=state.completed.size;
  try{parent.postMessage({channel:'dw-v33-module',type:'curriculum-mission-state',available:true,currentOpen:true,total:4,complete:count,currentComplete:count===4,recoveryCount:0,recoveryDays:[]},location.origin)}catch{}
}
function renderSubjects(){
  state.subject='';state.lesson=null;state.step='learn';state.feedback=null;setRoutine('');nodes.lessonView.hidden=true;nodes.subjectView.hidden=false;
  nodes.completeCount.textContent=String(state.completed.size);
  nodes.subjectGrid.innerHTML=Curriculum.SUBJECTS.map(subject=>`<button class="subject-card ${state.completed.has(subject.id)?'complete':''}" type="button" data-subject="${subject.id}"><span class="subject-icon">${subject.icon}</span><span><h3>${subject.name}</h3><p>${subject.description}</p><span class="subject-level">${escapeHtml(levelName(state.levels[subject.id]))} learning path</span></span><span class="subject-arrow">→</span></button>`).join('');
  nodes.subjectGrid.querySelectorAll('[data-subject]').forEach(button=>button.addEventListener('click',()=>openSubject(button.dataset.subject)));
  setStatus(state.completed.size===4?'You visited all four learning paths today. You may review one or be all done.':'Choose any subject. Nothing is locked.',state.completed.size===4?'success':'');
  notifyPortal();
}
function restoreLocal(subject){
  try{const value=JSON.parse(localStorage.getItem(localKey(subject))||'null');return value&&value.lessonId===state.lesson.id?value:null}catch{return null}
}
function openSubject(subject){
  if(!Curriculum.SUBJECTS.some(row=>row.id===subject))return;
  state.subject=subject;state.lesson=Curriculum.lessonFor(subject,state.levels[subject],daySeed(subject));state.step='learn';state.questionIndex=0;state.answers={};state.feedback=null;state.showResponse='';
  const saved=restoreLocal(subject);
  if(saved){state.answers=saved.answers||{};state.showResponse=saved.showResponse||'';if(saved.status==='complete')state.completed.add(subject)}
  const meta=Curriculum.SUBJECTS.find(row=>row.id===subject);
  nodes.lessonLevel.textContent=`${levelName(state.levels[subject])} skills`;nodes.lessonIcon.textContent=meta.icon;nodes.lessonSubject.textContent=`${meta.name.toUpperCase()} • FOUNDATIONAL K–4 PATH`;nodes.lessonTitle.textContent=state.lesson.title;nodes.lessonGoal.textContent=state.lesson.goal;
  nodes.subjectView.hidden=true;nodes.lessonView.hidden=false;renderStep();nodes.lessonTitle.focus?.();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function renderStep(){
  setRoutine(state.step==='complete'?'show':state.step);
  if(state.step==='learn')renderLearn();
  else if(state.step==='try')renderTry();
  else if(state.step==='show')renderShow();
  else renderComplete();
}
function renderLearn(){
  setStatus('Step 1 of 3: Learn. Listen or read, then continue when ready.');
  nodes.stepPanel.innerHTML=`<section class="learn-box"><div class="eyebrow">STEP 1 • LEARN</div><h3>Here is the idea</h3><p>${escapeHtml(state.lesson.learn)}</p><div class="example-box"><b>Example</b><p>${escapeHtml(state.lesson.example)}</p></div><p class="show-help">Learning focus: ${escapeHtml(state.lesson.standard)}</p><div class="step-actions">${state.readAloud?'<button class="control-button" type="button" data-read-lesson>🔊 Listen</button>':''}<button class="primary-button" type="button" data-start-try>I’m ready to try →</button></div></section>`;
  nodes.stepPanel.querySelector('[data-read-lesson]')?.addEventListener('click',()=>speak(`${state.lesson.title}. ${state.lesson.learn}. Example. ${state.lesson.example}`));
  nodes.stepPanel.querySelector('[data-start-try]').addEventListener('click',()=>{state.step='try';state.questionIndex=0;state.feedback=null;saveProgress('in-progress');renderStep()});
}
function renderTry(){
  const question=state.lesson.questions[state.questionIndex],selected=state.answers[`q${state.questionIndex}`];
  setStatus(`Step 2 of 3: Try. Question ${state.questionIndex+1} of ${state.lesson.questions.length}.`);
  nodes.stepPanel.innerHTML=`<section><div class="question-count">STEP 2 • TRY • ${state.questionIndex+1} OF ${state.lesson.questions.length}</div><h3 class="question-prompt">${escapeHtml(question.prompt)}</h3><div class="choice-list">${question.choices.map((choice,index)=>`<button class="choice-button ${selected===index?'selected':''}" type="button" data-answer="${index}">${escapeHtml(choice)}</button>`).join('')}</div>${state.feedback?`<div class="feedback-box ${state.feedback.correct?'good':'retry'}" role="status"><b>${state.feedback.correct?'Yes—that fits!':'Not yet. Nothing was lost.'}</b><p>${escapeHtml(state.feedback.message)}</p></div>`:''}<div class="step-actions"><button class="control-button" type="button" data-hint>💡 Show a hint</button>${state.feedback?.correct?`<button class="primary-button" type="button" data-next-question>${state.questionIndex+1<state.lesson.questions.length?'Next question →':'Go to Show →'}</button>`:''}</div></section>`;
  nodes.stepPanel.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>checkAnswer(Number(button.dataset.answer))));
  nodes.stepPanel.querySelector('[data-hint]').addEventListener('click',()=>{state.feedback={correct:false,message:question.hint};renderTry()});
  nodes.stepPanel.querySelector('[data-next-question]')?.addEventListener('click',()=>{if(state.questionIndex+1<state.lesson.questions.length){state.questionIndex++;state.feedback=null;renderTry()}else{state.step='show';state.feedback=null;saveProgress('in-progress');renderStep()}});
}
function checkAnswer(answer){
  const question=state.lesson.questions[state.questionIndex];state.answers[`q${state.questionIndex}`]=answer;
  state.feedback=answer===question.answer?{correct:true,message:'You found the answer. Take a breath, then continue when you are ready.'}:{correct:false,message:question.hint};
  saveProgress('in-progress');renderTry();
}
function renderShow(){
  setStatus('Step 3 of 3: Show what you know. Typing, paper, drawing, or telling a grown-up all count.');
  nodes.stepPanel.innerHTML=`<section class="show-box"><div class="eyebrow">STEP 3 • SHOW</div><h3>Show it your way</h3><p>${escapeHtml(state.lesson.showPrompt)}</p><textarea data-show-response aria-label="Your response" placeholder="Type here if you want. You can also use paper or tell a grown-up.">${escapeHtml(state.showResponse)}</textarea><p class="show-help">There is no word minimum. The goal is to explain your thinking in a way that works for you.</p><div class="step-actions"><button class="control-button" type="button" data-complete-paper>✓ I showed it on paper or aloud</button><button class="primary-button" type="button" data-complete>Save my response →</button></div></section>`;
  const textarea=nodes.stepPanel.querySelector('[data-show-response]');textarea.addEventListener('input',()=>{state.showResponse=textarea.value});
  nodes.stepPanel.querySelector('[data-complete]').addEventListener('click',()=>completeLesson(textarea.value.trim()||'Completed with a grown-up.'));
  nodes.stepPanel.querySelector('[data-complete-paper]').addEventListener('click',()=>completeLesson('Shown on paper or explained aloud.'));
}
async function completeLesson(response){
  state.showResponse=response;state.step='complete';state.completed.add(state.subject);await saveProgress('complete');renderComplete();notifyPortal();
}
function renderComplete(){
  setStatus('Path complete. You can choose another subject or stop for today.','success');nodes.completeCount.textContent=String(state.completed.size);
  nodes.stepPanel.innerHTML=`<section class="learn-box"><div class="eyebrow">PATH COMPLETE</div><h3>✨ You learned, tried, and showed!</h3><p>You may feel proud of the work you did. You do not need a perfect score to learn.</p><div class="step-actions"><button class="control-button" type="button" data-review>Review this lesson</button><button class="primary-button" type="button" data-choose-next>Choose another subject →</button></div></section>`;
  nodes.stepPanel.querySelector('[data-review]').addEventListener('click',()=>{state.step='learn';state.questionIndex=0;state.feedback=null;renderStep()});
  nodes.stepPanel.querySelector('[data-choose-next]').addEventListener('click',renderSubjects);
}
function visibleReadingText(){const target=nodes.lessonView.hidden?nodes.subjectView:nodes.lessonView;return target.innerText.replace(/\s+/g,' ').trim().slice(0,3500)}
function speak(text){
  if(!('speechSynthesis'in window)||typeof SpeechSynthesisUtterance!=='function'){setStatus('Read-aloud is not available in this browser.','error');return}
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(String(text||''));utterance.lang='en-US';utterance.rate=.86;utterance.pitch=1;speechSynthesis.speak(utterance);setStatus('Reading aloud. Press the read button again to restart.');
}
function goHome(){window.speechSynthesis?.cancel?.();try{if(parent!==window){parent.location.hash='#missions';return}}catch{}location.href='index.html#missions'}
async function loadChild(user){
  state.uid=user.uid;const [memberSnap,studentSnap]=await Promise.all([getDoc(doc(state.db,'familyMembers',user.uid)),getDoc(doc(state.db,'students',user.uid))]);
  if(!memberSnap.exists()||memberSnap.data()?.role!=='child'||memberSnap.data()?.active!==true)throw new Error('This sign-in is not an active family child profile.');
  const student=studentSnap.exists()?studentSnap.data():{},fallback=Curriculum.clampLevel(student.grade??0),saved=student.learningLevels||{};state.student=student;state.name=String(student.displayName||student.firstName||user.displayName||'adventurer').trim().slice(0,24)||'adventurer';state.readAloud=student.supportPreferences?.readAloud!==false;document.querySelector('[data-read-aloud]').hidden=!state.readAloud;
  for(const subject of Curriculum.SUBJECTS)state.levels[subject.id]=Curriculum.clampLevel(saved[subject.id]??fallback);
  nodes.childName.textContent=state.name;
  try{const snapshot=await getDocs(collection(state.db,'students',user.uid,'homeLearningProgress'));snapshot.forEach(row=>{const value=row.data();if(value.dateKey===phoenixDateKey()&&value.status==='complete')state.completed.add(value.subject)})}catch(error){console.warn('[Home Learning Paths progress]',error)}
  for(const subject of Curriculum.SUBJECTS){try{const local=JSON.parse(localStorage.getItem(localKey(subject.id))||'null');if(local?.status==='complete')state.completed.add(subject.id)}catch{}}
  renderSubjects();
}

document.querySelector('[data-back]').addEventListener('click',goHome);document.querySelector('[data-subjects]').addEventListener('click',renderSubjects);document.querySelector('[data-read-aloud]').addEventListener('click',()=>speak(visibleReadingText()));
document.querySelector('[data-break]').addEventListener('click',()=>{window.speechSynthesis?.cancel?.();nodes.breakOverlay.hidden=false;document.querySelector('[data-break-return]').focus()});
document.querySelector('[data-break-return]').addEventListener('click',()=>{nodes.breakOverlay.hidden=true;document.querySelector('[data-break]').focus()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!nodes.breakOverlay.hidden){nodes.breakOverlay.hidden=true;document.querySelector('[data-break]').focus()}});

if(!Curriculum||Curriculum.validate().length){setStatus('The Home learning paths could not load. Ask a grown-up for help.','error')}
else if(LOCAL_PREVIEW){state.uid='local-preview-child';state.name='Home Adventurer';state.levels={math:2,reading:2,writing:3,science:3};nodes.childName.textContent=state.name;setStatus('Local family preview. Progress stays on this device.');renderSubjects()}
else if(!config.projectId||!config.apiKey){setStatus('The Home Firebase connection is not configured.','error')}
else{
  const app=getApps().find(candidate=>candidate.options?.projectId===config.projectId)||getApps()[0]||initializeApp(config);state.db=getFirestore(app);const auth=getAuth(app);
  onAuthStateChanged(auth,user=>{if(!user){setStatus('Choose your picture, color, and animal on the Home sign-in page.','error');setTimeout(goHome,1200);return}loadChild(user).catch(error=>setStatus(error?.message||'Your learning paths could not open.','error'))});
}
