"use strict";

const crypto=require("node:crypto");

const COLOR_IDS=Object.freeze(["blue","green","purple","orange","pink","yellow"]);
const ANIMAL_IDS=Object.freeze(["fox","owl","bear","rabbit","turtle","fish"]);
const AVATAR_IDS=Object.freeze(["nyx","ember","mochi","blink"]);
const MAX_FAILURES=5;
const LOCKOUT_MS=10*60*1000;
const SCRYPT_OPTIONS=Object.freeze({N:16384,r:8,p:1,maxmem:64*1024*1024});

function cleanId(value,max=40){return String(value||"").trim().toLowerCase().slice(0,max)}
function profileId(value){const id=cleanId(value);return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)?id:""}
function secretInput(colorId,animalId){
  const color=cleanId(colorId,20),animal=cleanId(animalId,20);
  if(!COLOR_IDS.includes(color)||!ANIMAL_IDS.includes(animal))return "";
  return `dragonswood-home-v1\0${color}\0${animal}`;
}
function newSalt(){return crypto.randomBytes(24).toString("base64url")}
function hashSecret(colorId,animalId,salt){
  const input=secretInput(colorId,animalId),safeSalt=String(salt||"");
  if(!input||safeSalt.length<16)throw new Error("A valid visual secret and salt are required.");
  return crypto.scryptSync(input,safeSalt,64,SCRYPT_OPTIONS).toString("base64url");
}
function verifySecret(colorId,animalId,salt,storedHash){
  try{
    const actual=Buffer.from(hashSecret(colorId,animalId,salt),"base64url"),expected=Buffer.from(String(storedHash||""),"base64url");
    return actual.length===expected.length&&actual.length>0&&crypto.timingSafeEqual(actual,expected);
  }catch{return false}
}
function publicProfile(id,data={}){
  const nickname=String(data.nickname||"Adventurer").trim().slice(0,24)||"Adventurer";
  const avatarId=AVATAR_IDS.includes(data.avatarId)?data.avatarId:"nyx";
  return Object.freeze({id,nickname,avatarId,sortOrder:Math.max(0,Math.min(99,Number(data.sortOrder)||0))});
}
function attemptDecision({matches=false,failedAttempts=0,lockedUntilMs=0,now=Date.now()}={}){
  if(Number(lockedUntilMs)>Number(now))return Object.freeze({outcome:"locked",waitMs:Number(lockedUntilMs)-Number(now),failedAttempts:Math.max(0,Number(failedAttempts)||0)});
  if(matches)return Object.freeze({outcome:"success",waitMs:0,failedAttempts:0});
  const failures=Math.max(0,Number(failedAttempts)||0)+1;
  if(failures>=MAX_FAILURES)return Object.freeze({outcome:"locked",waitMs:LOCKOUT_MS,failedAttempts:0});
  return Object.freeze({outcome:"mismatch",waitMs:0,failedAttempts:failures});
}

module.exports={COLOR_IDS,ANIMAL_IDS,AVATAR_IDS,MAX_FAILURES,LOCKOUT_MS,profileId,secretInput,newSalt,hashSecret,verifySecret,publicProfile,attemptDecision};
