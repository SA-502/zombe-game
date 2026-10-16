// Mouse buttons must be independent: PointerEvent pointerdown only reports the
// first pressed button. MouseEvent reports subsequent buttons in an ADS chord.
export class CombatInput {
 constructor(){this.reset();}
 reset(){this.buttons=0;this.touchFire=false;this.aimToggle=false;this.request=false;}
 setButtons(mask){mask&=3;if((mask&1)&&!(this.buttons&1))this.request=true;this.buttons=mask;}
 setTouchFire(held){if(held&&!this.touchFire)this.request=true;this.touchFire=held;}
 toggleAim(){this.aimToggle=!this.aimToggle;}
 get firing(){return !!(this.buttons&1)||this.touchFire;}
 get aiming(){return !!(this.buttons&2)||this.aimToggle;}
 consumeShot(){const value=this.request;this.request=false;return value;}
}
