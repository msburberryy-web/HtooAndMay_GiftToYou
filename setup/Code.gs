/**
 * Htoo & May — gift backend for the GitHub Pages catalogue.
 * Install in the standalone gift Apps Script project (NOT the RSVP form script).
 * Deploy as a web app: Execute as Me, access Anyone. Keep the same deployment so the /exec URL never changes.
 *
 * Guest actions (no token): catalogue, lookup, submit, track (visits & cart), save (up to 5 saved gifts). A guest can only see or change the record of the code they hold.
 * Organiser actions (GIFT_TOKEN required, never put the token in the website): health, state, status.
 */
// Spreadsheet IDs live in Project Settings › Script properties (GIFT_SHEET_ID, RSVP_SHEET_ID), not in this public file.
// Optional: NOTIFY_EMAIL (comma-separated) to send new-request notifications somewhere other than the script owner.
const RSVP_TAB = 'RSVPs';
const COUPLES_TAB = 'Couples';
const CATALOGUE_TAB = 'Catalogue';
const SETTINGS_TAB = 'Gift settings';
// Set true ONLY when deploying under a Google Workspace account. Gmail cannot send true no-reply mail.
const GIFT_NO_REPLY = false;
const GIFT_REVISION_HOURS = 48;
const GIFT_TIME_ZONE = 'Asia/Tokyo';
const GIFT_CACHE_SECONDS = 60;
// With the edit triggers installed (setupGiftStandalone), cached answers are kept up to 6 hours: every manual edit
// to the Gift Manager or RSVP spreadsheet clears them at once, so guests never see outdated information.
const GIFT_LONG_CACHE_SECONDS = 21600;
const MAIL_QUEUE_PREFIX = 'MAILQ_';
const GIFT_ORIGIN = 'https://msburberryy-web.github.io/HtooAndMay_GiftToYou';
const GIFT_HEADERS = ['Shared code','Partner one','Partner two','Gift ID','Gift','Recipient','Email','Phone','Postcode','Address','Delivery note','Status','Tracking','Created at','Updated at','QR link'];
const GIFT_EMAIL_HEADERS = ['Email status','Email fingerprint','Email language'];
const GIFT_STATUSES = ['Awaiting choice','Requested','Ordered','Shipped','Delivered'];
// Couples columns U:Z — what each couple has done on the site (Japan time).
const GIFT_ACTIVITY_HEADERS = ['First visited at','Last visited at','Visits','Cart gift','Cart updated at','Saved gifts'];
const GIFT_ROW_WIDTH = 29; // A:AC
// Couples column AA: the order ID of the couple's current order. Every confirmation is also kept, never overwritten,
// as its own line in the Order history tab.
const GIFT_ORDER_COLUMN = 27;
// AB: when the guest can no longer change (first confirmation + 48 h). Order from the retailer after this time.
// AC: which order ID the Status refers to — filled automatically when Status becomes Ordered/Shipped/Delivered.
const GIFT_CLOSE_COLUMN = 28;
const GIFT_ORDERED_COLUMN = 29;
const GIFT_ORDER_HEADERS = ['Current order ID','Changes close at','Ordered order ID'];
const GIFT_STATUS_COLUMN = 12;
const GIFT_LOCKED_STATUSES = ['Ordered','Shipped','Delivered'];
const ORDERED_MISMATCH_FORMULA = '=AND($AC2<>"",$AC2<>$AA2)';
const ORDERS_TAB = 'Order history';
const ORDER_HEADERS = ['Order ID','Type','Shared code','Couple','Gift ID','Gift','Recipient','Email','Phone','Postcode','Address','Delivery note','Language','Submitted at','Replaces','Superseded by'];
const GIFT_MAX_SAVED = 5;
// The guest list (RSVPs) is cached for an hour to make code checks fast. Unknown codes always re-read the sheet,
// so newly issued codes work at once; other RSVP edits (e.g. Gift enabled = No) apply within an hour or after refreshCatalogueNow.
const GIFT_REGISTRY_CACHE_SECONDS = 3600;
const CATALOGUE_HEADERS = ['ID','Brand','Name','Category','Description','Details','Image','Source','Price','Enabled'];
const GIFT_CATEGORIES = ['Everyday','For the table','At home'];
const SETTINGS_DEFAULTS = [
 ['Open',false,'TRUE lets guests confirm gifts. Keep FALSE until the live test or launch.'],
 ['Deadline','2027-01-16','Last day to choose, YYYY-MM-DD, Japan time. Leave empty for "to be announced".'],
 ['Message','Thank you for being part of our story. Please choose one gift with our love.','']
];
// Seeds the Catalogue tab on first setup only. After that, the sheet is the source of truth.
// Image: an HTTPS URL, or a file name placed in the GitHub repo under public/products/.
const IMG = 'https://htoo-may-gift-edit.the-studioeternelle.chatgpt.site/products/';
const CATALOGUE_SEED = [
 ['kinto','KINTO','Travel tumbler · 500ml','Everyday','A little companion for wherever the day takes you.','An insulated stainless steel travel tumbler. The pictured colour is white.',IMG+'kinto.jpg','https://kinto.co.jp/products/20941',3520,false],
 ['iittala','iittala','Aino Aalto · two glasses','For the table','Two glasses, for everyday moments worth sharing.','A pair of 220ml Aino Aalto tumblers in clear glass.',IMG+'iittala.jpg','https://www.iittala.jp/products/detail/349',4400,false],
 ['snowpeak','Snow Peak','Titanium single mug · 450ml','Everyday','For a morning at home, or a weekend somewhere new.','A lightweight, single-wall titanium mug with folding handles. It does not insulate hot drinks.',IMG+'snowpeak.jpg','https://ec.snowpeak.co.jp/item/SNP0117A0185',3520,false],
 ['lecreuset','Le Creuset','Légère bowl · 500ml','For the table','A beautiful place for something made with love.','One 500ml stoneware bowl in cool mint.',IMG+'lecreuset.jpg','https://store.shopping.yahoo.co.jp/lecreuset-japon/lc12439.html',3850,false],
 ['bodum','BODUM','BRAZIL French press · 350ml','At home','A slower start, and a very good cup of coffee.','A manual French press coffee maker. Coffee is not included.',IMG+'bodum.jpg','https://store.shopping.yahoo.co.jp/bodumshop/10948.html',2970,false],
 ['towel','Imabari','Wooden-box face towel pair','At home','A small everyday comfort for your home.','Imabari Kinsei Shifuku towel gift SH55030. Two face towels in a wooden presentation box.',IMG+'towel.jpg','https://www.imabari-kinsei.com/c/purpose/purpose2/066SH55030000030',3300,false],
 ['hario-coffee','HARIO','Glass brewing kit','At home','A slow morning, made a little more beautiful.','Glass Brewing Kit S-VGBK-02-T. Includes a glass dripper and server, a measuring scoop and 40 paper filters. Coffee is not included.',IMG+'hario-coffee.jpg','https://shop.hariocorp.co.jp/products/s-vgbk-02-t',3300,true],
 ['hario-teapot','HARIO','Round glass teapot · 700ml','For the table','Something warm to share, one cup at a time.','Cha Cha Kyusu Maru CHJMN-70T. A 700ml heat-resistant glass teapot with a removable stainless steel tea strainer. Tea is not included.',IMG+'hario-teapot.jpg','https://shop.hariocorp.co.jp/products/chjmn-70t',3300,true],
 ['hario-bowls','HARIO','Lidded glass bowls · pair','At home','For the little things that make a home.','Bowlup BLP-3012-T. Two 1,200ml heat-resistant glass storage bowls with lids.',IMG+'hario-bowls.jpg','https://shop.hariocorp.co.jp/products/blp-3012-t',3300,true],
 ['hario-mug','HARIO','Tea & coffee brewer mug','Everyday','Your favourite cup, wherever the day begins.','TCM-300-GG-EC in greige, 300ml. Includes the tea and coffee brewing mug and heat-retaining lid. Tea and coffee are not included.',IMG+'hario-mug.jpg','https://shop.hariocorp.co.jp/products/tcm-300-gg-ec',3300,true],
 ['kinto-350-white','KINTO','Travel tumbler · 350ml · white','Everyday','A favourite drink, wherever the day takes you.','One 350ml insulated stainless steel travel tumbler in white, in a presentation box. Drinks are not included.',IMG+'kinto-350-white.jpg','https://shop.benesse.ne.jp/gift/list/item1_0Q/item2_01/item3_01/pro_1410064454/',3300,true],
 ['kinto-350-khaki','KINTO','Travel tumbler · 350ml · khaki','Everyday','A little companion for your everyday adventures.','One 350ml insulated stainless steel travel tumbler in khaki, in a presentation box. Drinks are not included.',IMG+'kinto-350-khaki.jpg','https://shop.benesse.ne.jp/gift/list/item1_0Q/item2_01/item3_01/pro_1410064455/',3300,true],
 ['imabari-wooden-blue','Imabari Kinsei','Wooden-box towel set · blue','At home','A soft everyday comfort, beautifully presented.','Monori towel set J in blue: one 60 × 110cm bath towel and one 31 × 33.5cm wash towel, 100% cotton, made in Japan. Presented in a wooden box.',IMG+'imabari-wooden-blue.jpg','https://shop.benesse.ne.jp/gift/list/item1_0O/item2_01/item3_01/pro_1410053669/',3300,true]
];
// Fill with reviewed RSVP row numbers, for example [12,13,14], then run issueGiftCodesForConfiguredRows.
const GIFT_ROWS_TO_ISSUE = [];

/* ───────────── Web app ───────────── */

// Opening the /exec URL in a browser is a safe way to confirm the deployment is live.
function doGet(){return output_({ok:true,data:{service:'htoo-may-gift',version:2}});}

function doPost(e){
 let lock,action='';cacheState__=null;
 try{
  let p;
  try{p=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');}catch(_){throw fault_('Invalid request.',400,'invalid');}
  if(!p||typeof p!=='object')throw fault_('Invalid request.',400,'invalid');
  action=String(p.action||'');
  if(action==='catalogue')return output_({ok:true,data:publicCatalogue_()});
  if(action==='lookup')return output_({ok:true,data:lookup_(normalizeCode_(p.code))});
  if(action==='submit'){lock=acquireLock_();return output_({ok:true,data:submit_(p)});}
  if(action==='track')return output_({ok:true,data:track_(p)});
  if(action==='save')return output_({ok:true,data:save_(p)});
  if(action==='health'||action==='state'||action==='status'){requireToken_(p);lock=acquireLock_();return output_({ok:true,data:admin_(action,p)});}
  throw fault_('Unknown action.',400,'invalid');
 }catch(error){
  // Shows in Apps Script › Executions (open the doPost row) so failed requests can be diagnosed.
  if(error.status)console.warn('doPost '+(action||'?')+' refused: '+error.status+' '+(error.reason||'')+' — '+error.message);
  else console.error('doPost '+(action||'?')+' failed: '+(error.stack||error));
  return output_({ok:false,status:error.status||503,reason:error.reason||'service',error:error.status?error.message:'The sheet could not save this request. Please retry with the same code.'});
 }finally{if(lock&&lock.hasLock())lock.releaseLock();}
}

function acquireLock_(){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw fault_('The sheet is busy. Please try again.',503,'busy');return lock;}
function requireToken_(p){
 const token=PropertiesService.getScriptProperties().getProperty('GIFT_TOKEN');
 if(!token||typeof p.token!=='string'||p.token!==token)throw fault_('Access denied.',403,'forbidden');
}

/* ───────────── Fast answers (cache) ───────────── */

let cacheState__=null;
function cacheState_(){
 if(cacheState__)return cacheState__;
 const p=PropertiesService.getScriptProperties();
 cacheState__={gen:p.getProperty('CACHE_GEN')||'0',seconds:p.getProperty('EDIT_TRIGGERS')==='2'?GIFT_LONG_CACHE_SECONDS:GIFT_CACHE_SECONDS,mailTrigger:p.getProperty('MAIL_TRIGGER')==='1'};
 return cacheState__;
}
function cacheKey_(name){return name+'-g'+cacheState_().gen;}
function lookupKey_(code){return cacheKey_('lookup-v1-'+code);}
function forgetLookup_(code){try{CacheService.getScriptCache().remove(lookupKey_(code));}catch(ignore){}}
// Any manual sheet edit: start a new cache generation (all cached answers are ignored from now on).
function bumpCacheGen_(){
 const p=PropertiesService.getScriptProperties();
 p.setProperty('CACHE_GEN',String((Number(p.getProperty('CACHE_GEN'))||0)+1));
 cacheState__=null;
}

/* ───────────── Catalogue & settings ───────────── */

function publicCatalogue_(){
 const cache=CacheService.getScriptCache(),key=cacheKey_('catalogue-v3'),cached=cache.get(key);
 if(cached)return JSON.parse(cached);
 const settings=readSettings_();
 const value={open:settings.open,deadline:settings.deadline,message:settings.message,gifts:readCatalogue_()};
 cache.put(key,JSON.stringify(value),cacheState_().seconds);
 return value;
}
function readCatalogue_(){
 const sh=giftBook_().getSheetByName(CATALOGUE_TAB);
 if(!sh)throw fault_('The gift catalogue is not set up yet.',503,'service');
 const values=sh.getDataRange().getValues(),headers=values.shift().map(text_);
 const at=CATALOGUE_HEADERS.map(h=>headers.indexOf(h));
 if(at.some(i=>i<0))throw fault_('The Catalogue tab needs its original column headers.',503,'service');
 const seen=new Set(),gifts=[];
 values.forEach(r=>{
  const id=text_(r[at[0]]);if(!id||seen.has(id))return;seen.add(id);
  const category=text_(r[at[3]]);
  gifts.push({id,brand:text_(r[at[1]]),name:text_(r[at[2]]),category:GIFT_CATEGORIES.indexOf(category)>=0?category:'Everyday',description:text_(r[at[4]]),details:text_(r[at[5]]),image:text_(r[at[6]]),source:text_(r[at[7]]),price:Number(r[at[8]])||0,enabled:bool_(r[at[9]])&&!!text_(r[at[2]])});
 });
 return gifts;
}
function readSettings_(){
 const sh=giftBook_().getSheetByName(SETTINGS_TAB);
 const map={};
 if(sh)sh.getDataRange().getValues().forEach(r=>{map[text_(r[0]).toLowerCase()]=r[1];});
 const rawDeadline=map.deadline;
 let deadline=rawDeadline instanceof Date?Utilities.formatDate(rawDeadline,GIFT_TIME_ZONE,'yyyy-MM-dd'):text_(rawDeadline);
 if(deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(deadline)){console.warn('Gift settings Deadline must be YYYY-MM-DD: '+deadline);deadline='';}
 return {open:bool_(map.open),deadline,message:text_(map.message)};
}
function deadlinePassed_(deadline){return !!deadline&&Date.now()>Date.parse(deadline+'T23:59:59+09:00');}
// Clears every cached answer. Manual sheet edits already do this automatically (edit triggers);
// run it after changes made another way (e.g. a script or a form adding rows).
function refreshCatalogueNow(){bumpCacheGen_();}

/* ───────────── Guest actions ───────────── */

function lookup_(code){
 const cache=CacheService.getScriptCache(),key=lookupKey_(code),hit=cache.get(key);
 if(hit)return JSON.parse(hit);
 const entry=registryEntry_(code);
 const found=findCoupleRow_(couplesSheet_(),code);
 const value={label:entry.label,selection:found&&found.value[3]?maskSelection_(selection_(found.value)):null,saved:found?savedIds_(found.value[25]):[],cart:cartId_(code)};
 cache.put(key,JSON.stringify(value),cacheState_().seconds);
 return value;
}

// Records a visit or a cart change. The website calls this in the background; guests never wait for it.
function track_(p){
 const code=normalizeCode_(p.code),event=String(p.event||'');
 if(event!=='visit'&&event!=='cart')throw fault_('Unknown event.',400,'invalid');
 const sheet=couplesSheet_(true);
 const found=activityRow_(sheet,code),row=found.value,now=japanNow_();
 if(event==='visit'){
  sheet.getRange(found.row,21,1,3).setNumberFormat('@').setValues([[text_(row[20])||now,now,String((Number(row[22])||0)+1)]]);
 }else{
  const giftId=typeof p.giftId==='string'?p.giftId.trim():'';
  let label='';
  if(giftId){const gift=publicCatalogue_().gifts.find(g=>g.id===giftId);if(!gift)throw fault_('Unknown gift.',400,'invalid');label=gift.brand+' — '+gift.name;}
  sheet.getRange(found.row,24,1,2).setNumberFormat('@').setValues([[cell_(label),now]]);
  setCartId_(code,giftId);forgetLookup_(code);
 }
 return {saved:true};
}

// Saves the couple's hearted gifts (up to GIFT_MAX_SAVED), replacing the previous list.
function save_(p){
 const code=normalizeCode_(p.code);
 const ids=Array.isArray(p.saved)?p.saved.filter(v=>typeof v==='string').map(v=>v.trim()).filter(Boolean):null;
 if(!ids||ids.length!==p.saved.length||new Set(ids).size!==ids.length)throw fault_('Please check your saved gifts.',400,'invalid');
 if(ids.length>GIFT_MAX_SAVED)throw fault_('You can save up to '+GIFT_MAX_SAVED+' gifts.',400,'limit');
 const known=new Set(publicCatalogue_().gifts.map(g=>g.id));
 if(ids.some(id=>!known.has(id)))throw fault_('That gift is no longer available.',409,'unavailable');
 const sheet=couplesSheet_(true);
 const found=activityRow_(sheet,code);
 sheet.getRange(found.row,26).setNumberFormat('@').setValue(ids.join(', '));
 forgetLookup_(code);
 return {saved:ids};
}
function activityRow_(sheet,code){
 const entry=registryEntry_(code);
 let found=findCoupleRow_(sheet,code);
 if(!found){ // First activity for this couple: create their row under the lock to avoid duplicates.
  const lock=acquireLock_();
  try{found=ensureCoupleRow_(sheet,entry);}finally{lock.releaseLock();}
 }
 return found;
}
// The cart (one gift) is remembered by gift ID in Script properties, so it comes back on reloads, return visits and
// other devices even if a gift is renamed. Couples › Cart gift shows the readable name for the organiser.
function cartId_(code){return text_(PropertiesService.getScriptProperties().getProperty('CART_'+code));}
function setCartId_(code,giftId){const p=PropertiesService.getScriptProperties();if(giftId)p.setProperty('CART_'+code,giftId);else p.deleteProperty('CART_'+code);}
function savedIds_(v){return text_(v).split(',').map(x=>x.trim()).filter(Boolean).slice(0,GIFT_MAX_SAVED);}

function submit_(p){
 const code=normalizeCode_(p.code);
 // Catalogue, settings and guest list come from the cache, which every manual sheet edit clears.
 const catalogue=publicCatalogue_();
 if(!catalogue.open)throw fault_('Gift selections are not open yet.',409,'closed');
 if(deadlinePassed_(catalogue.deadline))throw fault_('The selection period has ended.',409,'ended');
 if(p.consent!==true)throw fault_('Please agree to the use of your delivery details.',400,'invalid');
 const d=validateDelivery_(p.data);
 const gift=catalogue.gifts.find(g=>g.id===d.gift_id&&g.enabled);
 if(!gift)throw fault_('That gift is no longer available. Please choose another.',409,'unavailable');
 const entry=registryEntry_(code);
 const sheet=couplesSheet_(true);
 const found=ensureCoupleRow_(sheet,entry),row=found.value;
 if(['Awaiting choice','Requested',''].indexOf(text_(row[11]))<0)throw fault_('Your gift is already being prepared. Contact Htoo & May to change it.',409,'locked');
 const now=new Date().toISOString();
 const firstSubmitted=row[3]?text_(row[19]||row[14]||row[13]):now;
 if(row[3]&&(!Number.isFinite(Date.parse(firstSubmitted))||Date.now()>=Date.parse(firstSubmitted)+GIFT_REVISION_HOURS*3600000))throw fault_('The 48-hour revision window has ended. Contact Htoo & May for help.',409,'locked');
 const language=p.language==='my'?'my':'en';
 const previousOrder=text_(row[GIFT_ORDER_COLUMN-1]);
 // Pressing confirm again with nothing changed keeps the same order: no new history line, email or notification.
 const same=row[3]&&previousOrder&&[[3,gift.id],[5,d.recipient],[6,d.email],[7,d.phone],[8,d.postal],[9,d.address],[10,d.note]].every(([c,v])=>text_(row[c])===v);
 if(same){
  const sent=/^Sent/.test(text_(row[16]));
  return {saved:true,giftId:gift.id,gift_name:text_(row[4]),status:'Requested',order_id:previousOrder,emailStatus:sent?'sent':sendOrQueueEmails_(sheet,found.row,row,language,null,false),first_submitted_at:firstSubmitted};
 }
 const giftName=gift.brand+' — '+gift.name;
 const orderId=appendOrder_(row[3]?'CHANGED':'NEW',code,invite_(row).label||entry.label,gift.id,giftName,d,language,previousOrder);
 sheet.getRange(found.row,4,1,12).setNumberFormat('@').setValues([[cell_(gift.id),cell_(giftName),cell_(d.recipient),cell_(d.email),cell_(d.phone),cell_(d.postal),cell_(d.address),cell_(d.note),'Requested',row[12],text_(row[13])||now,now]]);
 sheet.getRange(found.row,20).setNumberFormat('@').setValue(firstSubmitted);
 sheet.getRange(found.row,GIFT_ORDER_COLUMN,1,2).setNumberFormat('@').setValues([[orderId,changesCloseAt_(firstSubmitted)]]);
 sheet.getRange(found.row,24,1,2).setNumberFormat('@').setValues([['',japanNow_()]]);setCartId_(code,''); // the ordered gift leaves the cart
 SpreadsheetApp.flush();
 forgetLookup_(code);
 // The row as just written (no extra sheet read needed).
 const updated=row.slice();
 [gift.id,giftName,d.recipient,d.email,d.phone,d.postal,d.address,d.note,'Requested',row[12],text_(row[13])||now,now].forEach((v,i)=>{updated[3+i]=v;});
 updated[19]=firstSubmitted;updated[GIFT_ORDER_COLUMN-1]=orderId;updated[GIFT_CLOSE_COLUMN-1]=changesCloseAt_(firstSubmitted);
 const emailStatus=sendOrQueueEmails_(sheet,found.row,updated,language,row[3]?{gift:text_(row[4]),address:text_(row[9]),order:previousOrder}:null,true);
 return {saved:true,giftId:gift.id,gift_name:text_(updated[4]),status:'Requested',order_id:orderId,emailStatus,first_submitted_at:firstSubmitted};
}

// Adds one line to Order history (never edited afterwards) and returns its new ID, e.g. HM-0007. Runs under the script lock.
function appendOrder_(type,code,couple,giftId,giftName,d,language,replaces){
 const sh=ensureOrdersTab_(giftBook_());
 const last=sh.getLastRow();
 const ids=last<2?[]:sh.getRange(2,1,last-1,1).getValues().map(r=>{const m=/^HM-(\d+)$/.exec(text_(r[0]));return m?Number(m[1]):0;});
 const orderId='HM-'+String(Math.max(0,...ids)+1).padStart(4,'0');
 if(last+1>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),1);
 sh.getRange(last+1,1,1,ORDER_HEADERS.length).setNumberFormat('@').setValues([[orderId,type,code,cell_(couple),cell_(giftId),cell_(giftName),cell_(d.recipient),cell_(d.email),cell_(d.phone),cell_(d.postal),cell_(d.address),cell_(d.note),language,japanNow_(),replaces||'','']]);
 // Mark the replaced line so nobody works from an outdated order. Only this column of older lines is ever written.
 if(replaces&&replaces!=='imported'&&last>=2){
  const index=sh.getRange(2,1,last-1,1).getValues().findIndex(r=>text_(r[0])===replaces);
  if(index>=0)sh.getRange(index+2,ORDER_HEADERS.length).setValue(orderId);
 }
 return orderId;
}
function changesCloseAt_(firstSubmitted){const t=Date.parse(firstSubmitted);return Number.isFinite(t)?Utilities.formatDate(new Date(t+GIFT_REVISION_HOURS*3600000),GIFT_TIME_ZONE,'yyyy-MM-dd HH:mm'):'';}

// Installable trigger (created by setupGiftStandalone): when Status on Couples changes, record which order it refers to.
function onGiftSheetEdit(e){
 try{
  bumpCacheGen_(); // any manual edit (Status, Tracking, Catalogue, Gift settings…) shows on the website at once
  const range=e&&e.range;if(!range)return;
  const sheet=range.getSheet();if(sheet.getName()!==COUPLES_TAB)return;
  const c1=range.getColumn(),c2=c1+range.getNumColumns()-1;if(GIFT_STATUS_COLUMN<c1||GIFT_STATUS_COLUMN>c2)return;
  const r1=Math.max(2,range.getRow()),r2=range.getRow()+range.getNumRows()-1;if(r2<r1)return;
  syncOrderedIds_(sheet,r1,r2-r1+1);
 }catch(error){console.warn('Status helper: '+(error.message||error));}
}
// Installable trigger on the RSVP spreadsheet: name, attendance or "Gift enabled" edits apply at once.
function onRsvpSheetEdit(){try{bumpCacheGen_();}catch(error){console.warn('RSVP edit helper: '+(error.message||error));}}
function syncOrderedIds_(sheet,firstRow,count){
 if(sheet.getMaxColumns()<GIFT_ROW_WIDTH)return;
 const status=sheet.getRange(firstRow,GIFT_STATUS_COLUMN,count,1).getValues();
 const ids=sheet.getRange(firstRow,GIFT_ORDER_COLUMN,count,3).getValues();
 const out=status.map((s,i)=>{
  const st=text_(s[0]),current=text_(ids[i][0]),recorded=text_(ids[i][2]);
  if(GIFT_LOCKED_STATUSES.indexOf(st)>=0)return [recorded||current]; // keep the first order it was set for (Ordered → Shipped keeps HM-0001)
  return ['']; // back to Requested/Awaiting: nothing ordered yet
 });
 sheet.getRange(firstRow,GIFT_ORDERED_COLUMN,count,1).setNumberFormat('@').setValues(out);
}

function validateDelivery_(data){
 const d=data&&typeof data==='object'?data:{};
 const s=v=>typeof v==='string'?v.normalize('NFKC').trim():'';
 const postal=s(d.postal).replace(/[\s\-‐−ー]/g,'');
 const out={gift_id:s(d.gift_id),recipient:s(d.recipient),email:s(d.email),phone:s(d.phone),postal:postal.slice(0,3)+'-'+postal.slice(3),address:s(d.address),note:s(d.note)};
 if(!out.gift_id||!out.recipient||out.recipient.length>100||out.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)||!/^\+?[\d ()-]{8,25}$/.test(out.phone)||!/^\d{7}$/.test(postal)||out.address.length<8||out.address.length>600||out.note.length>500)
  throw fault_('Please complete your delivery details.',400,'invalid');
 return out;
}

/* ───────────── Organiser actions (token) ───────────── */

function admin_(action,p){
 const sheet=couplesSheet_();ensureEmailColumns_(sheet);ensureRevisionColumn_(sheet);
 const registry=rsvpRegistry_();
 if(action==='health')return {sheetId:giftSheetId_(),couples:registry.size};
 syncRsvp_(sheet,registry);
 const rows=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),20).getValues().map((value,i)=>({row:i+2,value})).filter(r=>registry.has(text_(r.value[0]).toUpperCase()));
 if(action==='state')return {invitations:rows.map(r=>invite_(r.value)),selections:rows.filter(r=>r.value[3]).map(r=>selection_(r.value))};
 const code=normalizeCode_(p.code),found=rows.find(r=>text_(r.value[0])===code);
 if(!found)throw fault_('Code not found.',404,'not_found');
 if(GIFT_STATUSES.slice(1).indexOf(p.status)<0||!found.value[3])throw fault_('Please check the selection and delivery status.',400,'invalid');
 sheet.getRange(found.row,12,1,4).setValues([[p.status,cell_(text_(p.tracking).slice(0,150)),found.value[13],new Date().toISOString()]]);
 syncOrderedIds_(sheet,found.row,1);
 SpreadsheetApp.flush();forgetLookup_(code);return {saved:true};
}

/* ───────────── Sheets ───────────── */

function giftBook_(){return SpreadsheetApp.openById(giftSheetId_());}
function rsvpBook_(){return SpreadsheetApp.openById(rsvpSheetId_());}
function giftSheetId_(){return sheetIdProperty_('GIFT_SHEET_ID');}
function rsvpSheetId_(){return sheetIdProperty_('RSVP_SHEET_ID');}
function sheetIdProperty_(name){
 const id=text_(PropertiesService.getScriptProperties().getProperty(name));
 if(!id)throw fault_('Script property '+name+' is not set (Project Settings › Script properties).',503,'service');
 return id;
}
// One header read checks A:P (and, when withExtras, Q:AC; they are repaired only if something is missing).
function couplesSheet_(withExtras){
 const sheet=giftBook_().getSheetByName(COUPLES_TAB);
 if(!sheet)throw fault_('The organiser sheet needs its original column headers.',503,'service');
 const width=withExtras?Math.min(GIFT_ROW_WIDTH,sheet.getMaxColumns()):16;
 const headers=sheet.getRange(1,1,1,width).getValues()[0].map(text_);
 if(headers.slice(0,16).join('|')!==GIFT_HEADERS.join('|'))throw fault_('The organiser sheet needs its original column headers.',503,'service');
 if(withExtras){
  const expected=GIFT_EMAIL_HEADERS.concat(['First submitted at'],GIFT_ACTIVITY_HEADERS,GIFT_ORDER_HEADERS);
  if(headers.slice(16).join('|')!==expected.join('|')){ensureEmailColumns_(sheet);ensureRevisionColumn_(sheet);ensureActivityColumns_(sheet);}
 }
 return sheet;
}
function findCoupleRow_(sheet,code){
 const last=sheet.getLastRow();if(last<2)return null;
 const codes=sheet.getRange(2,1,last-1,1).getValues().map(r=>text_(r[0]).toUpperCase());
 const index=codes.indexOf(code);if(index<0)return null;
 if(codes.indexOf(code,index+1)>=0)throw fault_('Duplicate code in Gift Manager.',503,'service');
 const columns=Math.min(GIFT_ROW_WIDTH,sheet.getMaxColumns());
 const value=sheet.getRange(index+2,1,1,columns).getValues()[0];while(value.length<GIFT_ROW_WIDTH)value.push('');
 return {row:index+2,value};
}
function ensureCoupleRow_(sheet,entry){
 const found=findCoupleRow_(sheet,entry.code);
 const first=entry.names[0],second=entry.names[1]||'';
 if(found){
  if(text_(found.value[1])!==first||text_(found.value[2])!==second){sheet.getRange(found.row,2,1,2).setValues([[cell_(first),cell_(second)]]);found.value[1]=first;found.value[2]=second;forgetLookup_(entry.code);}
  return found;
 }
 const now=new Date().toISOString(),row=Math.max(2,sheet.getLastRow()+1);
 if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
 const value=[entry.code,cell_(first),cell_(second),'','','','','','','','','Awaiting choice','',now,now,GIFT_ORIGIN+'/#code='+entry.code];
 sheet.getRange(row,1,1,16).setNumberFormat('@').setValues([value]);
 SpreadsheetApp.flush();
 while(value.length<GIFT_ROW_WIDTH)value.push('');
 return {row,value};
}
function syncRsvp_(sheet,registry){registry.forEach(entry=>ensureCoupleRow_(sheet,entry));}

// Cached guest list for fast code checks. A code missing from the cache is re-checked against the sheet.
function registryEntry_(code){
 const cache=CacheService.getScriptCache(),key=cacheKey_('registry-v2'),hit=cache.get(key);
 if(hit){const entry=new Map(JSON.parse(hit)).get(code);if(entry)return entry;}
 const registry=rsvpRegistry_(),json=JSON.stringify(Array.from(registry.entries()));
 if(json.length<90000)cache.put(key,json,cacheState_().seconds===GIFT_LONG_CACHE_SECONDS?GIFT_LONG_CACHE_SECONDS:GIFT_REGISTRY_CACHE_SECONDS);
 const entry=registry.get(code);
 if(!entry)throw fault_('We could not find that shared gift code. Please check your card.',404,'not_found');
 return entry;
}

// Source of truth: a code in the private RSVP sheet, never a public JS list.
// Rows with problems are skipped (and logged) so one typo cannot take the site down for every guest.
function rsvpRegistry_(){
 const sh=rsvpBook_().getSheetByName(RSVP_TAB);
 if(!sh)throw fault_('RSVPs tab not found.',503,'service');
 const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(text_);
 const ci=codeColumn_(headers),di=headers.indexOf('Gift display name'),ei=headers.indexOf('Gift enabled'),ai=headers.indexOf('Attending'),ni=headers.indexOf('Name'),gi=headers.indexOf('Guest name(s)');
 if(ci<0||ai<0)throw fault_('Run setupGiftStandalone to add the Gift code column to RSVPs.',503,'service');
 const rows=sh.getLastRow()<2?[]:sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();
 const result=new Map(),duplicates=new Set();
 rows.forEach((r,i)=>{
  const code=text_(r[ci]).replace(/[\s-]/g,'').toUpperCase();if(!code)return;
  if(ei>=0&&text_(r[ei]).toLowerCase()==='no')return;
  if(!/^yes/i.test(text_(r[ai])))return;
  if(!/^[A-Z0-9]{6,40}$/.test(code)){console.warn('RSVP row '+(i+2)+': invalid gift code skipped.');return;}
  const override=di>=0?text_(r[di]):'';
  const main=ni>=0?text_(r[ni]):'';
  if(!override&&!main){console.warn('RSVP row '+(i+2)+': needs a Gift display name.');return;}
  const names=override?[override]:[main,gi>=0?text_(r[gi]):''].filter(Boolean);
  const unique=names.filter((name,index)=>names.findIndex(n=>key_(n)===key_(name))===index).slice(0,2);
  if(result.has(code)){duplicates.add(code);return;}
  result.set(code,{code,names:unique,label:unique.join(' & ')});
 });
 // A code on two rows is ambiguous: block it until the organiser fixes the RSVP sheet.
 duplicates.forEach(code=>{console.warn('Gift code '+code+' appears on more than one RSVP row and is blocked.');result.delete(code);});
 return result;
}
function ensureRsvpColumns_(){
 const sh=rsvpBook_().getSheetByName(RSVP_TAB);
 if(!sh)throw new Error('RSVPs tab not found.');
 const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(text_);
 ['Gift code','Gift display name','Gift QR link','Gift enabled'].forEach(name=>{
  if(name==='Gift code'&&codeColumn_(headers)>=0)return;
  if(headers.indexOf(name)>=0)return;
  const column=headers.length+1;if(column>sh.getMaxColumns())sh.insertColumnsAfter(sh.getMaxColumns(),1);
  sh.getRange(1,column).setValue(name);headers.push(name);
 });
 return {sh,headers};
}
function codeColumn_(headers){const shared=headers.indexOf('Shared code');return shared>=0?shared:headers.indexOf('Gift code');}
function ensureEmailColumns_(sheet){
 if(sheet.getMaxColumns()<19)sheet.insertColumnsAfter(sheet.getMaxColumns(),19-sheet.getMaxColumns());
 const existing=sheet.getRange(1,17,1,3).getValues()[0].map(text_);
 if(existing.some((v,i)=>v&&v!==GIFT_EMAIL_HEADERS[i]))throw new Error('Gift Manager columns Q:S must be available for email tracking.');
 if(existing.join('|')!==GIFT_EMAIL_HEADERS.join('|'))sheet.getRange(1,17,1,3).setValues([GIFT_EMAIL_HEADERS]);
}
function ensureActivityColumns_(sheet){
 if(sheet.getMaxColumns()<GIFT_ROW_WIDTH)sheet.insertColumnsAfter(sheet.getMaxColumns(),GIFT_ROW_WIDTH-sheet.getMaxColumns());
 const existing=sheet.getRange(1,21,1,GIFT_ACTIVITY_HEADERS.length).getValues()[0].map(text_);
 if(existing.join('|')!==GIFT_ACTIVITY_HEADERS.join('|')){
  if(existing.some((v,i)=>v&&v!==GIFT_ACTIVITY_HEADERS[i]))throw new Error('Gift Manager columns U:Z must be available for visit, cart and saved-gift tracking.');
  sheet.getRange(1,21,1,GIFT_ACTIVITY_HEADERS.length).setValues([GIFT_ACTIVITY_HEADERS]);
 }
 const orderHeaders=sheet.getRange(1,GIFT_ORDER_COLUMN,1,GIFT_ORDER_HEADERS.length).getValues()[0].map(text_);
 if(orderHeaders.some((v,i)=>v&&v!==GIFT_ORDER_HEADERS[i]))throw new Error('Gift Manager columns AA:AC must be available for '+GIFT_ORDER_HEADERS.join(', ')+'.');
 if(orderHeaders.join('|')!==GIFT_ORDER_HEADERS.join('|'))sheet.getRange(1,GIFT_ORDER_COLUMN,1,GIFT_ORDER_HEADERS.length).setValues([GIFT_ORDER_HEADERS]);
}
// Status dropdown (only the allowed values) and a red AC cell when the ordered order is not the current one.
function ensureStatusHelpers_(sheet){
 const rows=Math.max(1,sheet.getMaxRows()-1);
 sheet.getRange(2,GIFT_STATUS_COLUMN,rows,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(GIFT_STATUSES,true).setAllowInvalid(false).setHelpText('Choose a status from the list.').build());
 const rules=sheet.getConditionalFormatRules().filter(rule=>{const c=rule.getBooleanCondition&&rule.getBooleanCondition();return !(c&&c.getCriteriaValues()[0]===ORDERED_MISMATCH_FORMULA);});
 rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(ORDERED_MISMATCH_FORMULA).setBackground('#f4c7c3').setFontColor('#922139').setRanges([sheet.getRange(2,GIFT_ORDERED_COLUMN,rows,1)]).build());
 sheet.setConditionalFormatRules(rules);
}
// Three small triggers: edits on each spreadsheet (keep the website up to date) and a background email sender.
function ensureEditTrigger_(){
 const has=name=>ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===name);
 if(!has('onGiftSheetEdit'))ScriptApp.newTrigger('onGiftSheetEdit').forSpreadsheet(giftSheetId_()).onEdit().create();
 if(!has('onRsvpSheetEdit'))ScriptApp.newTrigger('onRsvpSheetEdit').forSpreadsheet(rsvpSheetId_()).onEdit().create();
 if(!has('processGiftEmailQueue'))ScriptApp.newTrigger('processGiftEmailQueue').timeBased().everyMinutes(1).create();
 const props=PropertiesService.getScriptProperties();
 props.setProperty('EDIT_TRIGGERS','2');props.setProperty('MAIL_TRIGGER','1');
 bumpCacheGen_();
}
function missingTriggers_(){
 const names=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
 return ['onGiftSheetEdit','onRsvpSheetEdit','processGiftEmailQueue'].filter(n=>names.indexOf(n)<0);
}
function editTriggerInstalled_(){return !missingTriggers_().length;}
function ensureOrdersTab_(book){
 let sh=book.getSheetByName(ORDERS_TAB);
 if(!sh){sh=book.insertSheet(ORDERS_TAB);sh.getRange(1,1,1,ORDER_HEADERS.length).setValues([ORDER_HEADERS]);sh.setFrozenRows(1);return sh;}
 const headers=sh.getRange(1,1,1,ORDER_HEADERS.length).getValues()[0].map(text_);
 if(headers.join('|')===ORDER_HEADERS.join('|'))return sh;
 // Tabs created before "Superseded by" existed: add the new header once.
 if(headers.slice(0,-1).join('|')===ORDER_HEADERS.slice(0,-1).join('|')&&!headers[ORDER_HEADERS.length-1]){sh.getRange(1,ORDER_HEADERS.length).setValue(ORDER_HEADERS[ORDER_HEADERS.length-1]);return sh;}
 throw new Error('The Order history tab needs its original column headers: '+ORDER_HEADERS.join(', '));
}
// Fills "Superseded by" for existing lines from their Replaces links (safe to run again).
function backfillSuperseded_(sh){
 const last=sh.getLastRow();if(last<2)return;
 const rows=sh.getRange(2,1,last-1,ORDER_HEADERS.length).getValues(),by={};
 rows.forEach(r=>{const rep=text_(r[14]);if(rep&&rep!=='imported')by[rep]=text_(r[0]);});
 const col=rows.map(r=>[text_(r[15])||by[text_(r[0])]||'']);
 sh.getRange(2,ORDER_HEADERS.length,col.length,1).setValues(col);
}
function backfillCloseTimes_(sheet){
 const last=sheet.getLastRow();if(last<2)return;
 const rows=sheet.getRange(2,1,last-1,GIFT_ROW_WIDTH).getValues();
 rows.forEach((r,i)=>{if(text_(r[3])&&!text_(r[GIFT_CLOSE_COLUMN-1]))sheet.getRange(i+2,GIFT_CLOSE_COLUMN).setNumberFormat('@').setValue(changesCloseAt_(text_(r[19]||r[14]||r[13])));});
}
// One-time: orders confirmed before Order history existed get an ID and a history line (Type NEW, Replaces "imported").
function backfillOrders_(sheet){
 const last=sheet.getLastRow();if(last<2)return 0;
 const rows=sheet.getRange(2,1,last-1,GIFT_ROW_WIDTH).getValues();let added=0;
 rows.forEach((r,i)=>{
  if(!text_(r[3])||text_(r[GIFT_ORDER_COLUMN-1]))return;
  const d={recipient:text_(r[5]),email:text_(r[6]),phone:text_(r[7]),postal:text_(r[8]),address:text_(r[9]),note:text_(r[10])};
  const id=appendOrder_('NEW',text_(r[0]),invite_(r).label,text_(r[3]),text_(r[4]),d,text_(r[18])||'en','imported');
  sheet.getRange(i+2,GIFT_ORDER_COLUMN).setNumberFormat('@').setValue(id);added++;
 });
 return added;
}
function ensureRevisionColumn_(sheet){
 if(sheet.getMaxColumns()<20)sheet.insertColumnsAfter(sheet.getMaxColumns(),20-sheet.getMaxColumns());
 const existing=text_(sheet.getRange(1,20).getValues()[0][0]);
 if(existing&&existing!=='First submitted at')throw new Error('Gift Manager column T must be available for First submitted at.');
 if(!existing)sheet.getRange(1,20).setValue('First submitted at');
}
function ensureCatalogueTab_(book){
 let sh=book.getSheetByName(CATALOGUE_TAB);
 if(!sh){
  sh=book.insertSheet(CATALOGUE_TAB);
  sh.getRange(1,1,1,CATALOGUE_HEADERS.length).setValues([CATALOGUE_HEADERS]);
  sh.getRange(2,1,CATALOGUE_SEED.length,1).setNumberFormat('@');
  sh.getRange(2,1,CATALOGUE_SEED.length,CATALOGUE_HEADERS.length).setValues(CATALOGUE_SEED);
  sh.getRange(2,CATALOGUE_HEADERS.length,CATALOGUE_SEED.length,1).insertCheckboxes();
  sh.setFrozenRows(1);
  return;
 }
 const headers=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(text_);
 const missing=CATALOGUE_HEADERS.filter(h=>headers.indexOf(h)<0);
 if(missing.length)throw new Error('Catalogue tab is missing columns: '+missing.join(', '));
}
function ensureSettingsTab_(book){
 let sh=book.getSheetByName(SETTINGS_TAB);
 if(!sh){sh=book.insertSheet(SETTINGS_TAB);sh.getRange(1,1,1,3).setValues([['Setting','Value','Notes']]);sh.setFrozenRows(1);}
 const keys=sh.getDataRange().getValues().map(r=>text_(r[0]).toLowerCase());
 SETTINGS_DEFAULTS.forEach(([key,value,note])=>{
  if(keys.indexOf(key.toLowerCase())>=0)return;
  const row=sh.getLastRow()+1;
  const cell=sh.getRange(row,2);
  if(key==='Deadline')cell.setNumberFormat('@');
  sh.getRange(row,1,1,3).setValues([[key,value,note]]);
  if(key==='Open')cell.insertCheckboxes();
 });
}

/* ───────────── Organiser setup & tools (run from the editor) ───────────── */

function setupGiftStandalone(){
 ensureRsvpColumns_();
 const book=giftBook_();book.setSpreadsheetTimeZone(GIFT_TIME_ZONE);
 const sheet=book.getSheetByName(COUPLES_TAB);
 if(!sheet||sheet.getRange(1,1,1,16).getValues()[0].map(text_).join('|')!==GIFT_HEADERS.join('|'))throw new Error('Gift Manager Couples headers do not match. Restore the original headers first.');
 ensureEmailColumns_(sheet);ensureRevisionColumn_(sheet);ensureActivityColumns_(sheet);sheet.setFrozenRows(1);sheet.setFrozenColumns(3);
 ensureCatalogueTab_(book);ensureSettingsTab_(book);ensureOrdersTab_(book);refreshCatalogueNow();
 const imported=backfillOrders_(sheet);if(imported)console.log(imported+' earlier order(s) added to Order history.');
 backfillSuperseded_(ensureOrdersTab_(book));
 backfillCloseTimes_(sheet);syncOrderedIds_(sheet,2,Math.max(1,sheet.getLastRow()-1));
 ensureStatusHelpers_(sheet);ensureEditTrigger_();
 MailApp.getRemainingDailyQuota(); // Requests send-mail permission; does not send anything.
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('GIFT_TOKEN'))props.setProperty('GIFT_TOKEN',(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''));
 console.log('Setup complete. Catalogue and Gift settings tabs are ready. Gift settings › Open stays FALSE until you change it.');
}
// Gives every RSVP row that has a name a long random gift code and QR link. Rows that already have a code keep it,
// so this is safe to run again after new RSVPs arrive. Codes only work for rows marked Attending = yes.
function issueGiftCodesForAllGuests(){
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const {sh,headers}=ensureRsvpColumns_();
  const last=sh.getLastRow();if(last<2){console.log('No RSVP rows yet.');return;}
  const ci=codeColumn_(headers),qi=headers.indexOf('Gift QR link'),ni=headers.indexOf('Name'),di=headers.indexOf('Gift display name');
  const rows=sh.getRange(2,1,last-1,headers.length).getValues();
  const existing=new Set(rows.map(r=>text_(r[ci]).replace(/[\s-]/g,'').toUpperCase()).filter(Boolean));
  let issued=0;const short=[];
  rows.forEach((r,i)=>{
   const row=i+2,named=(ni>=0&&text_(r[ni]))||(di>=0&&text_(r[di]));
   let code=text_(r[ci]).replace(/[\s-]/g,'').toUpperCase();
   if(!code){
    if(!named)return;
    do{code=Utilities.getUuid().replace(/-/g,'').slice(0,20).toUpperCase();}while(existing.has(code));
    existing.add(code);issued++;
    sh.getRange(row,ci+1).setValue(code);
   }else if(code.length<12)short.push(row);
   const link=GIFT_ORIGIN+'/#code='+code;
   if(qi>=0&&text_(r[qi])!==link)sh.getRange(row,qi+1).setValue(link);
  });
  SpreadsheetApp.flush();refreshCatalogueNow();
  console.log('Issued '+issued+' new gift code(s). Rows that already had a code kept it.');
  if(short.length)console.log('⚠️ RSVP row(s) '+short.join(', ')+' have a short code that could be guessed. Clear that code cell and run this again to replace it.');
 }finally{lock.releaseLock();}
}
function issueGiftCodesForConfiguredRows(){
 if(!Array.isArray(GIFT_ROWS_TO_ISSUE)||!GIFT_ROWS_TO_ISSUE.length)throw new Error('Set GIFT_ROWS_TO_ISSUE to the reviewed RSVP row numbers first.');
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{const {sh,headers}=ensureRsvpColumns_();issueCodesForRows_(sh,headers,GIFT_ROWS_TO_ISSUE);}finally{lock.releaseLock();}
}
function issueCodesForRows_(sh,headers,numbers){
 if(numbers.some(n=>!Number.isInteger(n)||n<2||n>sh.getLastRow())||new Set(numbers).size!==numbers.length)throw new Error('Use distinct valid RSVP row numbers.');
 const ci=codeColumn_(headers)+1,qi=headers.indexOf('Gift QR link')+1;
 const col=name=>headers.indexOf(name);
 const rows=numbers.map(n=>sh.getRange(n,1,1,headers.length).getValues()[0]);
 // Validate the entire selection before issuing any codes. Never infer who is a couple.
 rows.forEach((r,i)=>{
  const at=' (RSVP row '+numbers[i]+')';
  if(!/^yes/i.test(text_(r[col('Attending')]))||(!text_(r[col('Name')])&&!text_(r[col('Gift display name')])))throw new Error('Use attending guest rows with a name. For a shifted-name row, fill Gift display name first.'+at);
  if(Number(r[col('Party size')])>1&&!text_(r[col('Guest name(s)')])&&!text_(r[col('Gift display name')]))throw new Error('For a party of two without a second name, fill Gift display name with the couple name first.'+at);
  if(r[ci-1]&&!/^[A-Z0-9]{6,40}$/.test(text_(r[ci-1]).toUpperCase()))throw new Error('An existing code is invalid.'+at);
 });
 const all=sh.getRange(2,ci,Math.max(1,sh.getLastRow()-1),1).getValues().map(r=>text_(r[0]).toUpperCase()).filter(Boolean);
 if(new Set(all).size!==all.length)throw new Error('Duplicate gift codes already exist in RSVPs. Fix them first.');
 const existing=new Set(all);
 rows.forEach((r,i)=>{
  let code=text_(r[ci-1]).toUpperCase();
  if(!code){do{code=Utilities.getUuid().replace(/-/g,'').slice(0,20).toUpperCase();}while(existing.has(code));existing.add(code);}
  sh.getRange(numbers[i],ci).setNumberFormat('@').setValue(code);
  if(qi>0)sh.getRange(numbers[i],qi).setValue(GIFT_ORIGIN+'/#code='+code);
 });
 SpreadsheetApp.flush();
 refreshCatalogueNow();
}
function retryGiftEmails(){
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const sheet=couplesSheet_();ensureEmailColumns_(sheet);
  const rows=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),Math.min(GIFT_ROW_WIDTH,sheet.getMaxColumns())).getValues();
  rows.forEach((r,i)=>{if(r[3]&&r[6]&&/^(Failed|Queued)/.test(text_(r[16])))sendGiftConfirmation_(sheet,i+2,r,text_(r[18])==='my'?'my':'en');});
 }finally{lock.releaseLock();}
}

// Run from the editor to check the whole setup. Read-only: it changes nothing and sends nothing.
function checkGiftSetup(){
 let problems=0;
 const step=(name,fn)=>{try{const note=fn();console.log('✅ '+name+(note?' — '+note:''));}catch(e){problems++;console.log('❌ '+name+' — '+(e.message||e));}};
 step('RSVP sheet',()=>{
  const sh=rsvpBook_().getSheetByName(RSVP_TAB);if(!sh)throw new Error('No "'+RSVP_TAB+'" tab in the RSVP spreadsheet.');
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(text_);
  const missing=['Name','Attending'].filter(h=>headers.indexOf(h)<0).concat(codeColumn_(headers)<0?['Gift code']:[]);
  if(missing.length)throw new Error('Missing columns: '+missing.join(', '));
  const registry=rsvpRegistry_(),short=Array.from(registry.keys()).filter(c=>c.length<12);
  if(short.length)console.log('⚠️ '+short.length+' code(s) are shorter than 12 characters and could be guessed. Clear those code cells in RSVPs and run issueGiftCodesForAllGuests to replace them.');
  return registry.size+' guest code(s) can log in (attending, enabled, valid, not duplicated). Skipped rows are listed above as warnings.';
 });
 step('Couples tab (Gift Manager)',()=>{
  const sheet=couplesSheet_();
  const activity=sheet.getMaxColumns()>=GIFT_ROW_WIDTH?sheet.getRange(1,21,1,GIFT_ACTIVITY_HEADERS.length).getValues()[0].map(text_).join('|'):'';
  if(activity!==GIFT_ACTIVITY_HEADERS.join('|'))throw new Error('Columns U:Z ('+GIFT_ACTIVITY_HEADERS.join(', ')+') are not set up. Run setupGiftStandalone.');
  if(sheet.getRange(1,GIFT_ORDER_COLUMN,1,GIFT_ORDER_HEADERS.length).getValues()[0].map(text_).join('|')!==GIFT_ORDER_HEADERS.join('|'))throw new Error('Columns AA:AC ('+GIFT_ORDER_HEADERS.join(', ')+') are not set up. Run setupGiftStandalone.');
  return Math.max(0,sheet.getLastRow()-1)+' row(s)';
 });
 step('Gift settings tab',()=>{
  if(!giftBook_().getSheetByName(SETTINGS_TAB))throw new Error('Tab "'+SETTINGS_TAB+'" not found. Run setupGiftStandalone.');
  const s=readSettings_();
  return 'Open='+s.open+', Deadline='+(s.deadline||'(empty → "to be announced")')+(deadlinePassed_(s.deadline)?' (PASSED — guests cannot confirm)':'');
 });
 step('Order history tab',()=>{
  const sh=giftBook_().getSheetByName(ORDERS_TAB);if(!sh)throw new Error('Tab "'+ORDERS_TAB+'" not found. Run setupGiftStandalone.');
  const headers=sh.getRange(1,1,1,ORDER_HEADERS.length).getValues()[0].map(text_);
  if(headers.join('|')!==ORDER_HEADERS.join('|'))throw new Error('Headers changed. Expected: '+ORDER_HEADERS.join(', '));
  return Math.max(0,sh.getLastRow()-1)+' order line(s)';
 });
 step('Helpers (triggers)',()=>{const missing=missingTriggers_();if(missing.length)throw new Error('Not installed: '+missing.join(', ')+'. Run setupGiftStandalone.');return 'sheet edits show on the website at once; emails are sent in the background; "Ordered order ID" is recorded';});
 step('Email queue',()=>{const waiting=Object.keys(PropertiesService.getScriptProperties().getProperties()).filter(k=>k.indexOf(MAIL_QUEUE_PREFIX)===0).length;return waiting?waiting+' email batch(es) waiting (sent within a minute)':'empty';});
 step('Catalogue tab',()=>{
  const gifts=readCatalogue_(),enabled=gifts.filter(g=>g.enabled);
  if(!enabled.length)throw new Error('No enabled gifts. Tick Enabled for at least one row.');
  const noImage=enabled.filter(g=>!g.image).map(g=>g.id);
  return gifts.length+' gift(s), '+enabled.length+' enabled'+(noImage.length?'; missing Image: '+noImage.join(', '):'');
 });
 step('Website catalogue response',()=>{refreshCatalogueNow();const json=JSON.stringify(publicCatalogue_());return json.length+' characters, OK';});
 step('Script properties',()=>{giftSheetId_();rsvpSheetId_();return 'GIFT_SHEET_ID and RSVP_SHEET_ID set';});
 step('Notification recipient',()=>organiserEmails_().join(', '));
 step('Organiser token',()=>{if(!PropertiesService.getScriptProperties().getProperty('GIFT_TOKEN'))throw new Error('GIFT_TOKEN missing. Run setupGiftStandalone.');return 'present';});
 step('Email quota',()=>MailApp.getRemainingDailyQuota()+' email(s) left today');
 console.log(problems?problems+' problem(s) found — fix the ❌ lines above.':'All checks passed. If the website still shows an error, note the "Ref:" under the message and check Executions › doPost.');
}

/* ───────────── Email ───────────── */

// Guest confirmation email, in the wedding style. Only uses inline styles and tables so it renders in Gmail, Apple Mail and Outlook.
const MAIL={burgundy:'#7c3241',cream:'#fbf5e9',paper:'#f3ebdd',gold:'#b4935d',ink:'#3f362e',muted:'#746965'};
function guestEmail_(r,language){
 const my=language==='my',code=text_(r[0]);
 const t=my?{
  title:'လက်ဆောင်ရွေးချယ်မှု အတည်ပြုပြီးပါပြီ',hello:'ချစ်လှစွာသော '+invite_(r).label+'၊',
  intro:'ကျွန်တော်တို့ရဲ့ မင်္ဂလာနေ့ကို လာရောက်ချီးမြှင့်ပေးလို့ ကျေးဇူးအများကြီးတင်ပါတယ်။ သင်ရွေးထားတဲ့ လက်ဆောင်ကို လက်ခံရရှိပါပြီ။ ပွဲပြီးတဲ့နောက် ပို့ဆောင်ပေးဖို့ စီစဉ်ပါမယ်။ ငွေပေးချေရန် မလိုပါ။',
  order:'မှာယူမှုနံပါတ်',gift:'ရွေးထားသောလက်ဆောင်',deliver:'ပို့ဆောင်ရမည့်နေရာ',recipient:'လက်ခံမည့်သူ',phone:'ဖုန်းနံပါတ်',address:'လိပ်စာ',note:'မှတ်ချက်',when:'အတည်ပြုချိန်',code:'လက်ဆောင်ကုဒ်',
  button:'ကျွန်ုပ်၏လက်ဆောင်ကို ကြည့်ရန်',change:'ပထမဆုံး အတည်ပြုပြီး ၄၈ နာရီအတွင်း၊ ဆိုင်မှာ မမှာယူရသေးလျှင် လက်ဆောင်ကို ပြောင်းလဲနိုင်ပါတယ်။',
  footer:'ဤအီးမေးလ်ကို အလိုအလျောက် ပို့ပေးထားပါသည်။ ပြန်မဖြေပါနှင့်။ မေးမြန်းလိုပါက Htoo သို့မဟုတ် May ကို တိုက်ရိုက် ဆက်သွယ်ပေးပါ။',love:'ချစ်ခြင်းမေတ္တာဖြင့်၊ Htoo & May'
 }:{
  title:'Your gift request is confirmed',hello:'Dear '+invite_(r).label+',',
  intro:'Thank you for celebrating with us. We have received your gift choice, and we will arrange delivery after the celebration. No payment is required.',
  order:'Order ID',gift:'Your gift',deliver:'Delivering to',recipient:'Recipient',phone:'Phone',address:'Address',note:'Note',when:'Confirmed',code:'Gift code',
  button:'View my gift',change:'You can change your choice within 48 hours of your first confirmation, until it is ordered.',
  footer:'This is an automated confirmation. Please do not reply to this email. For help, contact Htoo or May directly.',love:'With love, Htoo & May'
 };
 const link=GIFT_ORIGIN+'/#code='+encodeURIComponent(code)+'&view=order';
 const font=my?"'Noto Sans Myanmar','Myanmar Text',Padauk,Arial,sans-serif":'Georgia,\'Times New Roman\',serif';
 const body=my?"'Noto Sans Myanmar','Myanmar Text',Padauk,Arial,sans-serif":'Arial,Helvetica,sans-serif';
 const e=escapeHtml_,rows=[[t.recipient,text_(r[5])],[t.phone,text_(r[7])],[t.address,'〒'+text_(r[8])+'\n'+text_(r[9])]].concat(text_(r[10])?[[t.note,text_(r[10])]]:[]);
 const detail=rows.map(([k,v])=>'<tr><td style="padding:6px 0;width:34%;vertical-align:top;color:'+MAIL.muted+';font-size:13px">'+e(k)+'</td><td style="padding:6px 0;vertical-align:top;color:'+MAIL.ink+';font-size:15px;white-space:pre-wrap">'+e(v)+'</td></tr>').join('');
 const html='<div style="margin:0;padding:24px 12px;background:'+MAIL.paper+'"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:'+MAIL.cream+';border:1px solid '+MAIL.gold+';border-collapse:separate">'
  +'<tr><td style="padding:36px 32px 8px;text-align:center"><img src="'+GIFT_ORIGIN+'/branding/monogram.png" width="88" height="88" alt="Htoo &amp; May" style="display:block;margin:0 auto 12px;border:0"><div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:'+MAIL.gold+'">16 · 10 · 2026</div>'
  +'<h1 style="margin:14px 0 6px;font-family:'+font+';font-weight:normal;font-size:28px;line-height:1.35;color:'+MAIL.burgundy+'">'+e(t.title)+'</h1><div style="width:60px;height:1px;background:'+MAIL.gold+';margin:16px auto"></div></td></tr>'
  +'<tr><td style="padding:0 32px;font-family:'+body+';font-size:15px;line-height:1.75;color:'+MAIL.ink+'"><p style="margin:0 0 10px">'+e(t.hello)+'</p><p style="margin:0 0 22px">'+e(t.intro)+'</p></td></tr>'
  +'<tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #e2d2c4"><tr><td style="padding:18px 20px;font-family:'+body+'">'
  +'<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:'+MAIL.gold+'">'+e(t.gift)+'</div><div style="margin-top:6px;font-family:Georgia,serif;font-size:21px;color:'+MAIL.burgundy+'">'+e(text_(r[4]))+'</div><div style="margin-top:2px;font-size:13px;color:'+MAIL.muted+'">× 1</div></td></tr></table></td></tr>'
  +'<tr><td style="padding:22px 32px 0;font-family:'+body+'"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:'+MAIL.gold+';margin-bottom:6px">'+e(t.deliver)+'</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'+detail
  +(text_(r[GIFT_ORDER_COLUMN-1])?'<tr><td style="padding:6px 0;color:'+MAIL.muted+';font-size:13px">'+e(t.order)+'</td><td style="padding:6px 0;color:'+MAIL.burgundy+';font-size:15px;font-weight:bold;letter-spacing:1px">'+e(text_(r[GIFT_ORDER_COLUMN-1]))+'</td></tr>':'')
  +'<tr><td style="padding:6px 0;color:'+MAIL.muted+';font-size:13px">'+e(t.when)+'</td><td style="padding:6px 0;color:'+MAIL.ink+';font-size:15px">'+e(japanTime_(text_(r[14])))+'</td></tr><tr><td style="padding:6px 0;color:'+MAIL.muted+';font-size:13px">'+e(t.code)+'</td><td style="padding:6px 0;color:'+MAIL.ink+';font-size:15px;letter-spacing:1px">'+e(maskCode_(code))+'</td></tr></table></td></tr>'
  +'<tr><td style="padding:28px 32px 8px;text-align:center"><a href="'+e(link)+'" style="display:inline-block;background:'+MAIL.burgundy+';color:'+MAIL.cream+';text-decoration:none;font-family:'+body+';font-size:16px;padding:14px 34px;border-radius:4px">'+e(t.button)+'</a>'
  +'<p style="margin:14px 0 0;font-family:'+body+';font-size:13px;line-height:1.6;color:'+MAIL.muted+'">'+e(t.change)+'</p></td></tr>'
  +'<tr><td style="padding:26px 32px 32px;text-align:center;font-family:'+body+'"><div style="width:60px;height:1px;background:'+MAIL.gold+';margin:0 auto 18px"></div><div style="font-family:'+font+';font-size:18px;color:'+MAIL.burgundy+'">'+e(t.love)+'</div><p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:'+MAIL.muted+'">'+e(t.footer)+'</p></td></tr></table></div>';
 const text=[t.title,'',t.hello,t.intro,'',t.gift+': '+text_(r[4])+' × 1',t.recipient+': '+text_(r[5]),t.phone+': '+text_(r[7]),t.address+': 〒'+text_(r[8])+' '+text_(r[9])]
  .concat(text_(r[10])?[t.note+': '+text_(r[10])]:[]).concat(text_(r[GIFT_ORDER_COLUMN-1])?[t.order+': '+text_(r[GIFT_ORDER_COLUMN-1])]:[]).concat([t.when+': '+japanTime_(text_(r[14])),t.code+': '+maskCode_(code),'',t.button+': '+link,t.change,'',t.love,t.footer]).join('\n');
 return {subject:'Htoo & May — '+t.title,html,text};
}
function sendGiftConfirmation_(sheet,row,r,language){
 ensureEmailColumns_(sheet);
 const fingerprint=JSON.stringify([text_(r[0]),text_(r[3]),text_(r[5]),text_(r[6]),text_(r[7]),text_(r[8]),text_(r[9]),text_(r[10]),language]);
 const state=sheet.getRange(row,17,1,3).getValues()[0];
 if(state[1]===fingerprint&&/^Sent/.test(text_(state[0])))return 'sent';
 // A send can succeed before the sent-marker write. Avoid sending again if that state is ambiguous.
 if(state[1]===fingerprint&&text_(state[0])==='Sending — check sent mail')return 'pending';
 let attempted=false;
 try{
  if(MailApp.getRemainingDailyQuota()<1)throw new Error('Daily email quota reached');
  sheet.getRange(row,17,1,3).setValues([['Sending — check sent mail',fingerprint,language]]);SpreadsheetApp.flush();
  const mail=guestEmail_(r,language);
  attempted=true;
  MailApp.sendEmail({to:text_(r[6]),subject:mail.subject,body:mail.text,htmlBody:mail.html,name:'Htoo & May',noReply:GIFT_NO_REPLY});
  sheet.getRange(row,17,1,3).setValues([['Sent '+new Date().toISOString(),fingerprint,language]]);SpreadsheetApp.flush();return 'sent';
 }catch(error){
  // After a send attempt, the result may be ambiguous. Manual sent-mail check prevents duplicate messages.
  const status=attempted?'Sending — check sent mail':'Failed — '+String(error.message||error).slice(0,150);
  try{sheet.getRange(row,17,1,3).setValues([[status,fingerprint,language]]);SpreadsheetApp.flush();}catch(ignore){}
  return attempted?'pending':'failed';
 }
}

// Confirmation + organiser emails are sent by a background job (every minute) so guests are not kept waiting.
// Without that trigger (setup not run yet) they are sent straight away, as before.
function sendOrQueueEmails_(sheet,rowNo,r,language,previous,notify){
 if(!cacheState_().mailTrigger){const status=sendGiftConfirmation_(sheet,rowNo,r,language);if(notify)notifyOrganiser_(r,previous,status);return status;}
 sheet.getRange(rowNo,17).setValue('Queued');
 // Running number (submits hold the script lock) keeps emails in the order the requests were made.
 const props=PropertiesService.getScriptProperties(),seq=(Number(props.getProperty('MAIL_SEQ'))||0)+1;props.setProperty('MAIL_SEQ',String(seq));
 props.setProperty(MAIL_QUEUE_PREFIX+String(seq).padStart(9,'0')+'_'+text_(r[0]),JSON.stringify({code:text_(r[0]),language,notify,previous:previous||null,row:r.map(text_)}));
 return 'queued';
}
function processGiftEmailQueue(){
 const props=PropertiesService.getScriptProperties();
 const keys=Object.keys(props.getProperties()).filter(k=>k.indexOf(MAIL_QUEUE_PREFIX)===0).sort();
 if(!keys.length)return;
 // Claim the waiting items under the lock, then send without holding it (guests can keep ordering meanwhile).
 const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return;
 const items=[];
 try{keys.forEach(k=>{const v=props.getProperty(k);if(v){items.push(JSON.parse(v));props.deleteProperty(k);}});}finally{lock.releaseLock();}
 if(!items.length)return;
 const sheet=couplesSheet_(true);
 // One guest email per couple, with their latest details and language; one organiser notification per request.
 const latest={},status={};
 items.forEach(item=>{latest[item.code]=item;});
 Object.keys(latest).forEach(code=>{
  try{const found=findCoupleRow_(sheet,code);status[code]=found&&found.value[3]?sendGiftConfirmation_(sheet,found.row,found.value,latest[code].language):'failed';}
  catch(error){status[code]='failed';console.warn('Guest email for '+code+': '+(error.message||error));}
 });
 items.forEach(item=>{try{if(item.notify)notifyOrganiser_(item.row,item.previous,status[item.code]);}catch(error){console.warn('Notification for '+item.code+': '+(error.message||error));}});
}

// Tells the organiser about every confirmed request (NEW, or CHANGED within the 48-hour window). Never blocks the guest.
function organiserEmails_(){
 const custom=text_(PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL'));
 const list=(custom?custom.split(','):[Session.getEffectiveUser().getEmail()]).map(x=>x.trim()).filter(Boolean);
 if(!list.length)throw new Error('No notification address: set NOTIFY_EMAIL in Script properties.');
 return list;
}
function notifyOrganiser_(r,previous,guestEmailStatus){
 try{
  const kind=previous?'CHANGED':'NEW',label=invite_(r).label;
  const orderId=text_(r[GIFT_ORDER_COLUMN-1]);
  const lines=[['Order ID',orderId+(previous&&previous.order?' (replaces '+previous.order+')':'')],['Couple',label],['Gift',text_(r[4])]].concat(previous&&previous.gift!==text_(r[4])?[['Previous gift',previous.gift]]:[])
   .concat([['Recipient',text_(r[5])],['Email',text_(r[6])],['Phone',text_(r[7])],['Postcode',text_(r[8])],['Address',text_(r[9])]])
   .concat(previous&&previous.address!==text_(r[9])?[['Previous address',previous.address]]:[])
   .concat([['Note',text_(r[10])||'—'],['Confirmed at',japanTime_(text_(r[14]))],['Changes close at',text_(r[GIFT_CLOSE_COLUMN-1])+' (order from the retailer after this time)'],['Guest email',guestEmailStatus],['Code',text_(r[0])]])
   .concat(previous&&previous.order?[['⚠ Reminder','If you already started ordering '+previous.order+', contact the guest before buying '+orderId+'.']]:[]);
  const sheetUrl='https://docs.google.com/spreadsheets/d/'+giftSheetId_()+'/edit';
  const e=escapeHtml_;
  const html='<div style="font-family:Arial,sans-serif;color:'+MAIL.ink+';max-width:600px"><p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:'+MAIL.gold+'">GIFT REQUEST · '+kind+'</p><h2 style="margin:0 0 14px;font-family:Georgia,serif;font-weight:normal;color:'+MAIL.burgundy+'">'+e(label)+'</h2><table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">'
   +lines.map(([k,v])=>'<tr><td style="padding:6px 12px 6px 0;color:'+MAIL.muted+';font-size:13px;vertical-align:top;width:30%;border-bottom:1px solid #eee">'+e(k)+'</td><td style="padding:6px 0;font-size:14px;white-space:pre-wrap;border-bottom:1px solid #eee">'+e(v)+'</td></tr>').join('')
   +'</table><p style="margin:18px 0 0"><a href="'+sheetUrl+'" style="color:'+MAIL.burgundy+'">Open the Gift Manager sheet</a></p></div>';
  MailApp.sendEmail({to:organiserEmails_().join(','),subject:'[Gift '+kind+'] '+orderId+' · '+label+' — '+text_(r[4]),body:lines.map(([k,v])=>k+': '+v).join('\n')+'\n\n'+sheetUrl,htmlBody:html,name:'Htoo & May gift page'});
 }catch(error){console.warn('Organiser notification not sent: '+(error.message||error));}
}

/* ───────────── Helpers ───────────── */

function normalizeCode_(v){
 const code=text_(v).replace(/[\s-]/g,'').toUpperCase();
 if(!/^[A-Z0-9]{6,40}$/.test(code))throw fault_('We could not find that shared gift code. Please check your card.',404,'not_found');
 return code;
}
function text_(v){return v instanceof Date?v.toISOString():String(v==null?'':v).trim();}
function bool_(v){return v===true||/^(true|yes|y|1)$/i.test(text_(v));}
function key_(s){return s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();}
function cell_(s){const value=String(s==null?'':s);return /^[=+\-@]/.test(value)?"'"+value:value;}
function japanNow_(){return Utilities.formatDate(new Date(),GIFT_TIME_ZONE,'yyyy-MM-dd HH:mm');}
function japanTime_(iso){const t=Date.parse(iso);return Number.isFinite(t)?Utilities.formatDate(new Date(t),GIFT_TIME_ZONE,'yyyy-MM-dd HH:mm')+' JST':iso;}
function invite_(r){const members=[text_(r[1]),text_(r[2])].filter(Boolean);return {code:text_(r[0]),label:members.join(' & '),members,created_at:text_(r[13])};}
function selection_(r){return {order_id:text_(r[GIFT_ORDER_COLUMN-1]),gift_id:text_(r[3]),gift_name:text_(r[4]),recipient:text_(r[5]),email:text_(r[6]),phone:text_(r[7]),postal:text_(r[8]),address:text_(r[9]),note:text_(r[10]),status:text_(r[11]),tracking:text_(r[12]),created_at:text_(r[13]),updated_at:text_(r[14]),first_submitted_at:text_(r[19]||r[14]||r[13])};}
// What a code holder sees on "My selection": enough to recognise their order, not enough to misuse it.
function maskSelection_(sel){return Object.assign({},sel,{email:maskEmail_(sel.email),phone:maskTail_(sel.phone,4),postal:sel.postal?sel.postal.slice(0,3)+'-••••':'',address:maskAddress_(sel.address),note:sel.note?'••••':'',masked:true});}
function maskEmail_(v){const at=v.indexOf('@');return at>0?v[0]+'•••'+v.slice(at):'';}
function maskTail_(v,keep){const digits=v.replace(/\D/g,'');return digits?'•••-'+digits.slice(-keep):'';}
function maskAddress_(v){const chars=Array.from(v);if(!chars.length)return '';const keep=Math.min(12,Math.ceil(chars.length/3));return chars.slice(0,keep).join('')+' •••';}
function maskCode_(code){return code.length>8?code.slice(0,4)+'…'+code.slice(-4):code;}
function fault_(message,status,reason){const e=new Error(message);e.status=status;e.reason=reason;return e;}
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function escapeHtml_(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
