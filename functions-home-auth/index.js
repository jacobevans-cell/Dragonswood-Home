"use strict";

const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {getFirestore,FieldValue,Timestamp}=require("firebase-admin/firestore");
const {createHomeVisualAuth}=require("./home-visual-auth");

if(!admin.apps.length)admin.initializeApp();

Object.assign(exports,createHomeVisualAuth({
  onCall,
  HttpsError,
  admin,
  db:getFirestore(),
  FieldValue,
  Timestamp,
  teacherEmail:"jacobicusjax@gmail.com"
}));
