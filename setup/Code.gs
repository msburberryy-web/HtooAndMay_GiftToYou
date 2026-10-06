/**
 * Htoo & May — gift backend for the GitHub Pages catalogue.
 * Install in the standalone gift Apps Script project (NOT the RSVP form script).
 * Deploy as a web app: Execute as Me, access Anyone. Keep the same deployment so the /exec URL never changes.
 *
 * Guest actions (no token): catalogue, lookup, submit, track (visits & cart), save (up to 5 saved gifts). A guest can only see or change the record of the code they hold.
 * Organiser actions (GIFT_TOKEN required, never put the token in the website): health, state, status.
 */
const GIFT_SHEET_ID = '1r9ngeMlOthZEMOjPIqVODOOtd2RxbtFa0ljARPOyiTQ';
const RSVP_SHEET_ID = '11SA4KyupcO7ElvLnXRSngOxbMIb6G035OtWJqGE_tdM';
const RSVP_TAB = 'RSVPs';
const COUPLES_TAB = 'Couples';
const CATALOGUE_TAB = 'Catalogue';
const SETTINGS_TAB = 'Gift settings';
// Set true ONLY when deploying under a Google Workspace account. Gmail cannot send true no-reply mail.
const GIFT_NO_REPLY = false;
const GIFT_REVISION_HOURS = 48;
const GIFT_TIME_ZONE = 'Asia/Tokyo';
const GIFT_CACHE_SECONDS = 60;
const GIFT_ORIGIN = 'https://msburberryy-web.github.io/HtooAndMay_GiftToYou';
const GIFT_HEADERS = ['Shared code','Partner one','Partner two','Gift ID','Gift','Recipient','Email','Phone','Postcode','Address','Delivery note','Status','Tracking','Created at','Updated at','QR link'];
const GIFT_EMAIL_HEADERS = ['Email status','Email fingerprint','Email language'];
const GIFT_STATUSES = ['Awaiting choice','Requested','Ordered','Shipped','Delivered'];
// Couples columns U:Z — what each couple has done on the site (Japan time).
const GIFT_ACTIVITY_HEADERS = ['First visited at','Last visited at','Visits','Cart gift','Cart updated at','Saved gifts'];
const GIFT_ROW_WIDTH = 26; // A:Z
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
 let lock,action='';
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

/* ───────────── Catalogue & settings ───────────── */

function publicCatalogue_(){
 const cache=CacheService.getScriptCache(),cached=cache.get('catalogue-v2');
 if(cached)return JSON.parse(cached);
 const settings=readSettings_();
 const value={open:settings.open,deadline:settings.deadline,message:settings.message,gifts:readCatalogue_()};
 cache.put('catalogue-v2',JSON.stringify(value),GIFT_CACHE_SECONDS);
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
// Run after editing the Catalogue, Gift settings or RSVPs to apply changes immediately
// (otherwise within a minute for the catalogue, an hour for RSVP edits).
function refreshCatalogueNow(){CacheService.getScriptCache().removeAll(['catalogue-v2','registry-v1']);}

/* ───────────── Guest actions ───────────── */

function lookup_(code){
 const entry=registryEntry_(code);
 const found=findCoupleRow_(couplesSheet_(),code);
 return {label:entry.label,selection:found&&found.value[3]?selection_(found.value):null,saved:found?savedIds_(found.value[25]):[]};
}

// Records a visit or a cart change. The website calls this in the background; guests never wait for it.
function track_(p){
 const code=normalizeCode_(p.code),event=String(p.event||'');
 if(event!=='visit'&&event!=='cart')throw fault_('Unknown event.',400,'invalid');
 const sheet=couplesSheet_();ensureActivityColumns_(sheet);
 const found=activityRow_(sheet,code),row=found.value,now=japanNow_();
 if(event==='visit'){
  sheet.getRange(found.row,21,1,3).setNumberFormat('@').setValues([[text_(row[20])||now,now,String((Number(row[22])||0)+1)]]);
 }else{
  const giftId=typeof p.giftId==='string'?p.giftId.trim():'';
  let label='';
  if(giftId){const gift=publicCatalogue_().gifts.find(g=>g.id===giftId);if(!gift)throw fault_('Unknown gift.',400,'invalid');label=gift.brand+' — '+gift.name;}
  sheet.getRange(found.row,24,1,2).setNumberFormat('@').setValues([[cell_(label),now]]);
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
 const sheet=couplesSheet_();ensureActivityColumns_(sheet);
 const found=activityRow_(sheet,code);
 sheet.getRange(found.row,26).setNumberFormat('@').setValue(ids.join(', '));
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
function savedIds_(v){return text_(v).split(',').map(x=>x.trim()).filter(Boolean).slice(0,GIFT_MAX_SAVED);}

function submit_(p){
 const code=normalizeCode_(p.code);
 const settings=readSettings_();
 if(!settings.open)throw fault_('Gift selections are not open yet.',409,'closed');
 if(deadlinePassed_(settings.deadline))throw fault_('The selection period has ended.',409,'ended');
 if(p.consent!==true)throw fault_('Please agree to the use of your delivery details.',400,'invalid');
 const d=validateDelivery_(p.data);
 const gift=readCatalogue_().find(g=>g.id===d.gift_id&&g.enabled);
 if(!gift)throw fault_('That gift is no longer available. Please choose another.',409,'unavailable');
 const entry=rsvpRegistry_().get(code);
 if(!entry)throw fault_('We could not find that shared gift code. Please check your card.',404,'not_found');
 const sheet=couplesSheet_();ensureEmailColumns_(sheet);ensureRevisionColumn_(sheet);
 const found=ensureCoupleRow_(sheet,entry),row=found.value;
 if(['Awaiting choice','Requested',''].indexOf(text_(row[11]))<0)throw fault_('Your gift is already being prepared. Contact Htoo & May to change it.',409,'locked');
 const now=new Date().toISOString();
 const firstSubmitted=row[3]?text_(row[19]||row[14]||row[13]):now;
 if(row[3]&&(!Number.isFinite(Date.parse(firstSubmitted))||Date.now()>=Date.parse(firstSubmitted)+GIFT_REVISION_HOURS*3600000))throw fault_('The 48-hour revision window has ended. Contact Htoo & May for help.',409,'locked');
 sheet.getRange(found.row,4,1,12).setNumberFormat('@').setValues([[cell_(gift.id),cell_(gift.brand+' — '+gift.name),cell_(d.recipient),cell_(d.email),cell_(d.phone),cell_(d.postal),cell_(d.address),cell_(d.note),'Requested',row[12],text_(row[13])||now,now]]);
 sheet.getRange(found.row,20).setNumberFormat('@').setValue(firstSubmitted);
 SpreadsheetApp.flush();
 const updated=sheet.getRange(found.row,1,1,16).getValues()[0];
 const language=p.language==='my'?'my':'en';
 const emailStatus=sendGiftConfirmation_(sheet,found.row,updated,language);
 return {saved:true,giftId:gift.id,gift_name:text_(updated[4]),status:'Requested',emailStatus,first_submitted_at:firstSubmitted};
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
 if(action==='health')return {sheetId:GIFT_SHEET_ID,couples:registry.size};
 syncRsvp_(sheet,registry);
 const rows=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),20).getValues().map((value,i)=>({row:i+2,value})).filter(r=>registry.has(text_(r.value[0]).toUpperCase()));
 if(action==='state')return {invitations:rows.map(r=>invite_(r.value)),selections:rows.filter(r=>r.value[3]).map(r=>selection_(r.value))};
 const code=normalizeCode_(p.code),found=rows.find(r=>text_(r.value[0])===code);
 if(!found)throw fault_('Code not found.',404,'not_found');
 if(GIFT_STATUSES.slice(1).indexOf(p.status)<0||!found.value[3])throw fault_('Please check the selection and delivery status.',400,'invalid');
 sheet.getRange(found.row,12,1,4).setValues([[p.status,cell_(text_(p.tracking).slice(0,150)),found.value[13],new Date().toISOString()]]);
 SpreadsheetApp.flush();return {saved:true};
}

/* ───────────── Sheets ───────────── */

function giftBook_(){return SpreadsheetApp.openById(GIFT_SHEET_ID);}
function couplesSheet_(){
 const sheet=giftBook_().getSheetByName(COUPLES_TAB);
 if(!sheet||sheet.getRange(1,1,1,16).getValues()[0].map(text_).join('|')!==GIFT_HEADERS.join('|'))throw fault_('The organiser sheet needs its original column headers.',503,'service');
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
  if(text_(found.value[1])!==first||text_(found.value[2])!==second){sheet.getRange(found.row,2,1,2).setValues([[cell_(first),cell_(second)]]);found.value[1]=first;found.value[2]=second;}
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
 const cache=CacheService.getScriptCache(),hit=cache.get('registry-v1');
 if(hit){const entry=new Map(JSON.parse(hit)).get(code);if(entry)return entry;}
 const registry=rsvpRegistry_(),json=JSON.stringify(Array.from(registry.entries()));
 if(json.length<90000)cache.put('registry-v1',json,GIFT_REGISTRY_CACHE_SECONDS);
 const entry=registry.get(code);
 if(!entry)throw fault_('We could not find that shared gift code. Please check your card.',404,'not_found');
 return entry;
}

// Source of truth: a code in the private RSVP sheet, never a public JS list.
// Rows with problems are skipped (and logged) so one typo cannot take the site down for every guest.
function rsvpRegistry_(){
 const sh=SpreadsheetApp.openById(RSVP_SHEET_ID).getSheetByName(RSVP_TAB);
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
 const sh=SpreadsheetApp.openById(RSVP_SHEET_ID).getSheetByName(RSVP_TAB);
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
 if(existing.join('|')===GIFT_ACTIVITY_HEADERS.join('|'))return;
 if(existing.some((v,i)=>v&&v!==GIFT_ACTIVITY_HEADERS[i]))throw new Error('Gift Manager columns U:Z must be available for visit, cart and saved-gift tracking.');
 sheet.getRange(1,21,1,GIFT_ACTIVITY_HEADERS.length).setValues([GIFT_ACTIVITY_HEADERS]);
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
 ensureCatalogueTab_(book);ensureSettingsTab_(book);refreshCatalogueNow();
 MailApp.getRemainingDailyQuota(); // Requests send-mail permission; does not send anything.
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('GIFT_TOKEN'))props.setProperty('GIFT_TOKEN',(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,''));
 console.log('Setup complete. Catalogue and Gift settings tabs are ready. Gift settings › Open stays FALSE until you change it.');
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
  const rows=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),19).getValues();
  rows.forEach((r,i)=>{if(r[3]&&r[6]&&/^Failed/.test(text_(r[16])))sendGiftConfirmation_(sheet,i+2,r,text_(r[18])==='my'?'my':'en');});
 }finally{lock.releaseLock();}
}

// Run from the editor to check the whole setup. Read-only: it changes nothing and sends nothing.
function checkGiftSetup(){
 let problems=0;
 const step=(name,fn)=>{try{const note=fn();console.log('✅ '+name+(note?' — '+note:''));}catch(e){problems++;console.log('❌ '+name+' — '+(e.message||e));}};
 step('RSVP sheet',()=>{
  const sh=SpreadsheetApp.openById(RSVP_SHEET_ID).getSheetByName(RSVP_TAB);if(!sh)throw new Error('No "'+RSVP_TAB+'" tab in the RSVP spreadsheet.');
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(text_);
  const missing=['Name','Attending'].filter(h=>headers.indexOf(h)<0).concat(codeColumn_(headers)<0?['Gift code']:[]);
  if(missing.length)throw new Error('Missing columns: '+missing.join(', '));
  return rsvpRegistry_().size+' guest code(s) can log in (attending, enabled, valid, not duplicated). Skipped rows are listed above as warnings.';
 });
 step('Couples tab (Gift Manager)',()=>{
  const sheet=couplesSheet_();
  const activity=sheet.getMaxColumns()>=GIFT_ROW_WIDTH?sheet.getRange(1,21,1,GIFT_ACTIVITY_HEADERS.length).getValues()[0].map(text_).join('|'):'';
  if(activity!==GIFT_ACTIVITY_HEADERS.join('|'))throw new Error('Columns U:Z ('+GIFT_ACTIVITY_HEADERS.join(', ')+') are not set up. Run setupGiftStandalone.');
  return Math.max(0,sheet.getLastRow()-1)+' row(s)';
 });
 step('Gift settings tab',()=>{
  if(!giftBook_().getSheetByName(SETTINGS_TAB))throw new Error('Tab "'+SETTINGS_TAB+'" not found. Run setupGiftStandalone.');
  const s=readSettings_();
  return 'Open='+s.open+', Deadline='+(s.deadline||'(empty → "to be announced")')+(deadlinePassed_(s.deadline)?' (PASSED — guests cannot confirm)':'');
 });
 step('Catalogue tab',()=>{
  const gifts=readCatalogue_(),enabled=gifts.filter(g=>g.enabled);
  if(!enabled.length)throw new Error('No enabled gifts. Tick Enabled for at least one row.');
  const noImage=enabled.filter(g=>!g.image).map(g=>g.id);
  return gifts.length+' gift(s), '+enabled.length+' enabled'+(noImage.length?'; missing Image: '+noImage.join(', '):'');
 });
 step('Website catalogue response',()=>{refreshCatalogueNow();const json=JSON.stringify(publicCatalogue_());return json.length+' characters, OK';});
 step('Organiser token',()=>{if(!PropertiesService.getScriptProperties().getProperty('GIFT_TOKEN'))throw new Error('GIFT_TOKEN missing. Run setupGiftStandalone.');return 'present';});
 step('Email quota',()=>MailApp.getRemainingDailyQuota()+' email(s) left today');
 console.log(problems?problems+' problem(s) found — fix the ❌ lines above.':'All checks passed. If the website still shows an error, note the "Ref:" under the message and check Executions › doPost.');
}

/* ───────────── Email ───────────── */

function confirmationFields_(r,language){
 const labels=language==='my'?['ဧည့်သည်အမည်','လက်ဆောင်ကုဒ်','ရွေးထားသောလက်ဆောင်','အရေအတွက်','လက်ခံမည့်သူ','အီးမေးလ်','ဖုန်းနံပါတ်','စာပို့သင်္ကေတ','လိပ်စာ','ပို့ဆောင်ရန် မှတ်ချက်','အတည်ပြုချိန်','ပို့ဆောင်ရန်အချက်အလက်များ အသုံးပြုခြင်းကို သဘောတူမှု']:['Registered guest(s)','Shared gift code','Selected gift','Quantity','Recipient','Email','Phone','Postcode','Delivery address','Delivery note','Confirmed at','Consent to use delivery details'];
 const values=[invite_(r).label,text_(r[0]),text_(r[4]),'1',text_(r[5]),text_(r[6]),text_(r[7]),text_(r[8]),text_(r[9]),text_(r[10])||'—',japanTime_(text_(r[14])),language==='my'?'သဘောတူပါသည်':'Agreed'];
 return labels.map((label,i)=>[label,values[i]]);
}
function sendGiftConfirmation_(sheet,row,r,language){
 ensureEmailColumns_(sheet);
 const fingerprint=JSON.stringify([text_(r[0]),text_(r[3]),text_(r[5]),text_(r[6]),text_(r[7]),text_(r[8]),text_(r[9]),text_(r[10]),language]);
 const state=sheet.getRange(row,17,1,3).getValues()[0];
 if(state[1]===fingerprint&&/^Sent/.test(text_(state[0])))return 'sent';
 // A send can succeed before the sent-marker write. Avoid sending again if that state is ambiguous.
 if(state[1]===fingerprint&&text_(state[0])==='Sending — check sent mail')return 'pending';
 const fields=confirmationFields_(r,language);
 const title=language==='my'?'လက်ဆောင်ရွေးချယ်မှု အတည်ပြုပြီးပါပြီ':'Your gift request is confirmed';
 const note=language==='my'?'ဤအီးမေးလ်ကို အလိုအလျောက် ပို့ပေးထားပါသည်။ ပြန်မဖြေပါနှင့်။ မေးမြန်းလိုပါက Htoo သို့မဟုတ် May ကို တိုက်ရိုက် ဆက်သွယ်ပေးပါ။':'This is an automated confirmation. Please do not reply to this email. For help, contact Htoo or May directly.';
 const intro=language==='my'?'ပွဲပြီးတဲ့နောက် လက်ဆောင်ပို့ဆောင်ပေးဖို့ စီစဉ်ပါမယ်။ ငွေပေးချေရန် မလိုပါ။':'Htoo & May will arrange delivery after the celebration. No payment is required.';
 let attempted=false;
 try{
  if(MailApp.getRemainingDailyQuota()<1)throw new Error('Daily email quota reached');
  sheet.getRange(row,17,1,3).setValues([['Sending — check sent mail',fingerprint,language]]);SpreadsheetApp.flush();
  const html='<div style="font-family:Arial,sans-serif;line-height:1.8;color:#6b293d;max-width:620px"><h1>Htoo &amp; May</h1><h2>'+escapeHtml_(title)+'</h2><p>'+escapeHtml_(intro)+'</p><table style="width:100%;border-collapse:collapse">'+fields.map(([k,v])=>'<tr><th style="text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #ddd">'+escapeHtml_(k)+'</th><td style="padding:8px;border-bottom:1px solid #ddd;white-space:pre-wrap">'+escapeHtml_(v)+'</td></tr>').join('')+'</table><p><strong>'+escapeHtml_(note)+'</strong></p></div>';
  attempted=true;
  MailApp.sendEmail({to:text_(r[6]),subject:'Htoo & May — '+title,body:title+'\n\n'+intro+'\n\n'+fields.map(([k,v])=>k+': '+v).join('\n')+'\n\n'+note,htmlBody:html,name:'Htoo & May · Gift confirmation',noReply:GIFT_NO_REPLY});
  sheet.getRange(row,17,1,3).setValues([['Sent '+new Date().toISOString(),fingerprint,language]]);SpreadsheetApp.flush();return 'sent';
 }catch(error){
  // After a send attempt, the result may be ambiguous. Manual sent-mail check prevents duplicate messages.
  const status=attempted?'Sending — check sent mail':'Failed — '+String(error.message||error).slice(0,150);
  try{sheet.getRange(row,17,1,3).setValues([[status,fingerprint,language]]);SpreadsheetApp.flush();}catch(ignore){}
  return attempted?'pending':'failed';
 }
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
function selection_(r){return {gift_id:text_(r[3]),gift_name:text_(r[4]),recipient:text_(r[5]),email:text_(r[6]),phone:text_(r[7]),postal:text_(r[8]),address:text_(r[9]),note:text_(r[10]),status:text_(r[11]),tracking:text_(r[12]),created_at:text_(r[13]),updated_at:text_(r[14]),first_submitted_at:text_(r[19]||r[14]||r[13])};}
function fault_(message,status,reason){const e=new Error(message);e.status=status;e.reason=reason;return e;}
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function escapeHtml_(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
