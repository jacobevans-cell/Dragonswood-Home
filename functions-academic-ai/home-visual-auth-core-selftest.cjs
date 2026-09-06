"use strict";

const assert=require("node:assert/strict");
const Core=require("./home-visual-auth-core");

assert.equal(Core.profileId(" Child-One "),"child-one");
assert.equal(Core.profileId("not okay!"),"");
assert.equal(Core.secretInput("blue","fox"),"dragonswood-home-v1\0blue\0fox");
assert.equal(Core.secretInput("red","fox"),"");
const salt=Core.newSalt(),hash=Core.hashSecret("purple","owl",salt);
assert.equal(Core.verifySecret("purple","owl",salt,hash),true);
assert.equal(Core.verifySecret("purple","bear",salt,hash),false);
assert.equal(Core.verifySecret("green","owl",salt,hash),false);
assert.deepEqual(Core.publicProfile("child-one",{nickname:"  River  ",avatarId:"ember",sortOrder:2}),{id:"child-one",nickname:"River",avatarId:"ember",sortOrder:2});
assert.equal(Object.hasOwn(Core.publicProfile("child-one",{secretHash:"do-not-return"}),"secretHash"),false);
assert.deepEqual(Core.attemptDecision({matches:false,failedAttempts:0,now:100}),{outcome:"mismatch",waitMs:0,failedAttempts:1});
assert.deepEqual(Core.attemptDecision({matches:false,failedAttempts:4,now:100}),{outcome:"locked",waitMs:Core.LOCKOUT_MS,failedAttempts:0});
assert.deepEqual(Core.attemptDecision({matches:true,failedAttempts:3,now:100}),{outcome:"success",waitMs:0,failedAttempts:0});
assert.deepEqual(Core.attemptDecision({matches:true,failedAttempts:0,lockedUntilMs:600,now:100}),{outcome:"locked",waitMs:500,failedAttempts:0});
console.log("Home visual auth core self-test: PASS");
