import {useEffect,useRef,useState,FormEvent} from 'react';
import {Gift,Config,defaultConfig,gifts} from '@/lib/catalogue';
import {giftCopy} from '@/lib/gift-copy';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Check,CheckCircle2,Heart,ShoppingBag} from 'lucide-react';
import OrderStatus from './OrderStatus';
import DeliveryScene from './DeliveryScene';
import {ApiError,callGiftApi,giftImage,imageFallback} from '@/lib/api';
import {forgetGuest,readCatalogue,readGuest,writeCatalogue,writeGuest} from '@/lib/guest-cache';
type Selection={masked?:boolean;order_id?:string;gift_id:string;gift_name?:string;recipient:string;email:string;phone:string;postal:string;address:string;note:string;status:string;tracking:string;first_submitted_at?:string};
type Stage='detail'|'cart'|'delivery'|'review'|'success';
const empty={recipient:'',email:'',phone:'',postal:'',address:'',note:''};
// Short technical reference shown under service errors, to help the organiser diagnose problems.
const errorRef=(action:string,e:unknown)=>e instanceof ApiError?`Ref: ${action} · ${e.reason}${e.status?' '+e.status:''} · ${e.message}`:`Ref: ${action} · ${e instanceof Error?e.message:'error'}`;
const MAX_SAVED=5;
type LookupData={label:string;selection:Selection|null;saved?:string[]};
const prepareConfig=(d:Config):Config=>({...d,gifts:d.gifts.map(g=>({...g,...giftImage(g.image)}))});
type Field='recipient'|'email'|'phone'|'postal'|'address'|'consent';
const FIELD_ORDER:Field[]=['recipient','email','phone','postal','address','consent'];
const draftKey=(c:string)=>'gift-draft-'+c;
// True on the very first frame when a QR/email link or a remembered code will be checked, so the page opens in its final layout.
const hasPendingCode=()=>{try{return /^#code=[A-Za-z0-9]{6,40}/.test(window.location.hash)||!!sessionStorage.getItem('gift-code')}catch{return false}};
const pickForm=(f:typeof empty)=>({recipient:f.recipient,email:f.email,phone:f.phone,postal:f.postal,address:f.address,note:f.note});
export default function Catalogue(){
 const [lang,setLang]=useState<'en'|'my'>('en'),[config,setConfig]=useState<Config>(defaultConfig),[loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(''),[category,setCategory]=useState('All gifts');
 const [detail,setDetail]=useState<Gift|null>(null),[cart,setCart]=useState<Gift|null>(null),[panel,setPanel]=useState(false),[stage,setStage]=useState<Stage>('cart'),[code,setCode]=useState(''),[label,setLabel]=useState(''),[verified,setVerified]=useState(''),[form,setForm]=useState(empty),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selection,setSelection]=useState<Selection|null>(null),[emailStatus,setEmailStatus]=useState(''),[saved,setSaved]=useState<string[]>([]),[saveNote,setSaveNote]=useState(''),[opening,setOpening]=useState(hasPendingCode),[focusOrder,setFocusOrder]=useState(false),[view,setView]=useState<'shop'|'order'>('shop'),[touched,setTouched]=useState<Partial<Record<Field,boolean>>>({}),[toast,setToast]=useState('');
 const toastTimer=useRef<number|undefined>(undefined);
 function notify(message:string){setToast(message);window.clearTimeout(toastTimer.current);toastTimer.current=window.setTimeout(()=>setToast(''),2400)}
 const saveSeq=useRef(0);
 const t=giftCopy[lang];
 const ended=!!config.deadline&&Date.now()>new Date(config.deadline+'T23:59:59+09:00').getTime();
 function resetGuest(){if(verified)void forgetGuest(verified);setVerified('');setLabel('');setCode('');setPanel(false);setCart(null);setSelection(null);setForm(empty);setConsent(false);setEmailStatus('');setError('');setSaved([]);setSaveNote('');sessionStorage.removeItem('gift-code')}
 function guestError(e:unknown){if(!(e instanceof ApiError))return `${t.serviceError} (${errorRef('request',e)})`;switch(e.reason){case 'not_found':return t.invalidCode;case 'invalid':return t.invalidDetails;case 'locked':return t.cannotChange;case 'closed':return t.closed;case 'ended':return t.ended;case 'unavailable':return t.giftUnavailable;case 'limit':return t.saveLimit;default:return `${t.serviceError} (${errorRef('request',e)})`;}}
 // Show the remembered gift list at once, then refresh it from Google in the background.
 function load(){setLoadError('');const cached=readCatalogue<Config>();if(cached){setConfig(prepareConfig(cached));setLoaded(true)}
  callGiftApi<Config>('catalogue').then(d=>{writeCatalogue(d);setConfig(prepareConfig(d));setLoaded(true)}).catch(e=>{console.error('Gift catalogue failed',e);if(!cached)setLoadError(errorRef('catalogue',e))});}
 // Return visits: show the remembered name and order at once, then confirm with Google in the background.
 async function lookup(value=code,showExisting=false){
  setError('');const normalized=value.replace(/[\s-]/g,'').toUpperCase();
  const refreshing=verified===normalized;
  const apply=(d:LookupData,keepForm:boolean)=>{setSaved(d.saved??[]);setLabel(d.label);setSelection(d.selection);if(!keepForm){setCode(normalized);setVerified(normalized);setEmailStatus('');setConsent(false);setForm(empty);try{sessionStorage.setItem('gift-code',normalized)}catch{}}};
  const cached=showExisting||refreshing?null:await readGuest<LookupData>(normalized);
  if(cached){apply(cached,false);setOpening(false)}
  setBusy(!cached);
  try{
   const d=await callGiftApi<LookupData>('lookup',{code:normalized});
   apply(d,!!cached||refreshing);void writeGuest(normalized,d);recordVisit(normalized);
   if(d.selection){if(showExisting){const g=config.gifts.find(g=>g.id===d.selection!.gift_id)??gifts.find(g=>g.id===d.selection!.gift_id);if(g){setCart(g);setStage('success');setPanel(true)}else setError(t.unavailableGift)}}else if(showExisting){setError(t.noSelection)}
  }catch(e){
   const gone=e instanceof ApiError&&e.reason==='not_found';
   if(gone)void forgetGuest(normalized);
   if(cached&&!gone)return; // keep showing the remembered page; it refreshes next time
   if(!verified||cached){resetGuest();setCode(normalized)}
   setError(guestError(e));
  }finally{setBusy(false)}}
 const lookupRef=useRef(lookup);lookupRef.current=lookup;
 // Activity for the organiser's sheet (visits, cart). Sent in the background; failures are ignored.
 function track(payload:Record<string,unknown>){void callGiftApi('track',payload).catch(e=>console.warn('Activity not recorded',e))}
 function recordVisit(c:string){const key='gift-visit-'+c;try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1')}catch{}track({code:c,event:'visit'})}
 function setCartGift(gift:Gift|null){if((gift?.id??'')!==(cart?.id??'')&&verified)track({code:verified,event:'cart',giftId:gift?.id??''});setCart(gift)}
 function toggleSaved(id:string){
  const previous=saved,next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];
  if(next.length>MAX_SAVED){setSaveNote(t.saveLimit);return}
  setSaved(next);setSaveNote('');notify(next.length>previous.length?t.toastSaved:t.toastUnsaved);const seq=++saveSeq.current;
  callGiftApi<{saved:string[]}>('save',{code:verified,saved:next}).then(d=>{if(seq===saveSeq.current)setSaved(d.saved)}).catch(e=>{if(seq===saveSeq.current){setSaved(previous);setSaveNote(guestError(e))}});
 }
 // A QR card opens …/#code=XXXX. Check it straight away, then remove it from the address bar.
 // The confirmation email links to …/#code=XXXX&view=order to open the guest's order progress directly.
 function cardCode(){const card=/^#code=([A-Za-z0-9]{6,40})(&view=order)?$/.exec(window.location.hash);if(card){window.history.replaceState(null,'',window.location.pathname+window.location.search);if(card[2])setFocusOrder(true)}return card?card[1]:null}
 useEffect(()=>{load();const l=localStorage.getItem('gift-language');if(l==='my')switchLang('my');const start=cardCode()??sessionStorage.getItem('gift-code');if(start){setCode(start.toUpperCase());setOpening(true);void lookupRef.current(start).finally(()=>setOpening(false))}
  const onHash=()=>{const c=cardCode();if(c){setCode(c.toUpperCase());setOpening(true);void lookupRef.current(c).finally(()=>setOpening(false))}};window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash)},[]);
 function switchLang(l:'en'|'my'){if(l==='my')void import('@/lib/burmese-font');setLang(l);localStorage.setItem('gift-language',l)}
 function openCart(){setDetail(null);setStage('cart');setPanel(true);setError('')}
 function add(gift:Gift|null=detail){if(!gift||locked)return;setCartGift(gift);openCart();setConsent(false);notify(t.added)}
 async function submit(){if(!cart||!verified||!consent)return;setBusy(true);setError('');try{const d=await callGiftApi<{gift_name?:string;order_id?:string;emailStatus?:string;first_submitted_at?:string}>('submit',{code:verified,consent,language:lang,data:{...pickForm(form),gift_id:cart.id}});setSelection({...pickForm(form),gift_id:cart.id,gift_name:d.gift_name,order_id:d.order_id,status:'Requested',tracking:'',first_submitted_at:d.first_submitted_at??selection?.first_submitted_at});setEmailStatus(d.emailStatus??'');try{sessionStorage.removeItem(draftKey(verified))}catch{}setStage('success')}catch(e){setError(guestError(e))}finally{setBusy(false)}}
 useEffect(()=>{if(focusOrder){setView('order');setFocusOrder(false)}},[focusOrder]);
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer)},[]);
 const locked=!!selection&&(selection.status!=='Requested'||!selection.first_submitted_at||clock>=Date.parse(selection.first_submitted_at)+48*3600000);
 // "My order" opens instantly with what is already loaded, then refreshes from the sheet in the background.
 function openOrder(){setView('order');setPanel(false);window.scrollTo({top:0});if(verified&&!busy)void lookup(verified)}
 function goShop(scrollToGifts=false){setView('shop');if(scrollToGifts)window.setTimeout(()=>document.getElementById('collection')?.scrollIntoView({behavior:'smooth',block:'start'}),60);else window.scrollTo({top:0})}
 function finishOrder(){setPanel(false);setCartGift(null)}
 const changeCloses=selection?.first_submitted_at?new Date(Date.parse(selection.first_submitted_at)+48*3600000).toLocaleString(lang==='my'?'my-MM':'en-GB',{timeZone:'Asia/Tokyo',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'';
 // Friendly, bilingual field checks (same rules as the server).
 function fieldErrors():Partial<Record<Field,string>>{
  const e:Partial<Record<Field,string>>={};
  if(!form.recipient.trim())e.recipient=t.errRecipient;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))e.email=t.errEmail;
  if(!/^\+?[\d ()-]{8,25}$/.test(form.phone.normalize('NFKC').trim()))e.phone=t.errPhone;
  if(!/^\d{7}$/.test(form.postal.normalize('NFKC').replace(/[\s\-‐−ー]/g,'')))e.postal=t.errPostal;
  if(form.address.trim().length<8)e.address=t.errAddress;
  if(!consent)e.consent=t.errConsent;
  return e;
 }
 const errors=fieldErrors();
 const showError=(f:Field)=>touched[f]&&errors[f]?<p className="field-error" id={'err-'+f} role="alert">{errors[f]}</p>:null;
 const fieldProps=(f:Field)=>({'aria-invalid':!!(touched[f]&&errors[f]),'aria-describedby':touched[f]&&errors[f]?'err-'+f:undefined,onBlur:()=>setTouched(x=>({...x,[f]:true}))});
 function updateForm(next:typeof empty){setForm(next);try{if(verified)sessionStorage.setItem(draftKey(verified),JSON.stringify(next))}catch{}}
 function next(e:FormEvent){
  e.preventDefault();
  const bad=FIELD_ORDER.filter(f=>errors[f]);
  if(bad.length){setTouched(Object.fromEntries(FIELD_ORDER.map(f=>[f,true])));setError(t.fixErrors);document.getElementById('field-'+bad[0])?.focus();return}
  setStage('review');setError('')
 }
 function startDelivery(){setConsent(false);setTouched({});if(!form.recipient&&!form.address){try{const d=sessionStorage.getItem(draftKey(verified));if(d)setForm({...empty,...JSON.parse(d)})}catch{}}setStage('delivery')}
 const summary=cart&&<div className="selected-summary"><img src={cart.image} srcSet={cart.srcSet} sizes="76px" alt="" onError={imageFallback}/><div><strong>{cart.brand}</strong><p>{cart.name}</p><p>{lang==='my'?'အရေအတွက် — ၁':'Quantity — 1'}</p></div></div>;
 const headings={detail:detail?.brand??'',cart:t.cart,delivery:t.delivery,review:t.summary,success:t.confirmed};

 const languageSwitch=<button type="button" className="language-toggle" role="switch" aria-checked={lang==='my'} aria-label="Use Burmese language" onClick={()=>switchLang(lang==='en'?'my':'en')}><span lang="en">EN</span><span className="toggle-track" aria-hidden="true"><span/></span><span lang="my">မြန်မာ</span></button>;
 const deadline=<p className="ordering-deadline" role="status">{config.deadline?<>{t.due} <time dateTime={config.deadline}>{new Date(config.deadline+'T00:00:00+09:00').toLocaleDateString(lang==='my'?'my-MM':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Tokyo'})}</time>{ended&&<> · {t.ended}</>}</>:t.deadlinePending}</p>;
 const monogram=<div className="invitation-mark"><img src={`${import.meta.env.BASE_URL}branding/monogram.png`} alt="Htoo & May monogram" width="480" height="480"/></div>;
 if(!verified&&!opening)return <div lang={lang==='my'?'my':'en'} className={lang==='my'?'burmese':''}><div className="site-shell"><header className="masthead"><a className="wordmark" href={import.meta.env.BASE_URL}>Htoo & May</a>{languageSwitch}</header><main className="login-page">{deadline}<section className="login-card">{monogram}<h1>{t.loginTitle}</h1>{opening?<div className="opening" role="status"><div className="opening-dots" aria-hidden="true"><span/><span/><span/></div><p>{t.opening}</p></div>:<><p>{t.loginIntro}</p><form onSubmit={e=>{e.preventDefault();void lookup()}}><label htmlFor="gift-code">{t.loginId}<input id="gift-code" required autoCapitalize="characters" autoComplete="username" maxLength={40} placeholder={t.code} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><button className="primary full" disabled={busy}>{busy?t.checking:t.enter}</button></form></>}{error&&<p className="error" role="alert">{error}</p>}<p className="fine">{t.codeHelp}</p></section></main><footer><span>{t.thanks}</span></footer></div></div>;
 return <div lang={lang==='my'?'my':'en'} className={lang==='my'?'burmese':''}><div className="site-shell"><header className="masthead"><a className="wordmark" href={import.meta.env.BASE_URL}>Htoo & May</a><nav><a href="#guide">{t.guideLink}</a><button aria-current={view==='order'?'page':undefined} onClick={()=>{if(verified)openOrder();else document.getElementById('gift-code')?.focus()}}>{t.my}</button><button onClick={openCart}><ShoppingBag size={17} aria-hidden="true"/> {t.cart} ({cart?1:0})</button></nav>{languageSwitch}</header>
 <main>{deadline}{view==='order'?<section className="order-page" aria-label={t.orderPage}>
 <button type="button" className="text-button back-link" onClick={()=>goShop()}>← {t.continue}</button>
 {selection?<>
  <OrderStatus order={selection} gift={config.gifts.find(g=>g.id===selection.gift_id)??gifts.find(g=>g.id===selection.gift_id)} language={lang} busy={busy} onRefresh={()=>void lookup(verified)}/>
  {!locked&&changeCloses&&<div className="change-box"><p>{t.changeUntil.replace('{time}',changeCloses)}</p><button type="button" className="outline" onClick={()=>{setCategory('All gifts');goShop(true)}}>{t.changeGift}</button></div>}
 </>:<div className="saved-empty" role="status"><p>{busy||opening?t.checking:t.noSelection}</p>{!busy&&!opening&&<button type="button" className="primary" onClick={()=>goShop(true)}>{t.continue}</button>}</div>}
 </section>:<><section className="intro">{monogram}<p className="date">16 October 2026</p><h1>{t.title}</h1><p>{t.intro}</p></section>
 <section className="guest-access" aria-label={t.code}>{opening&&!label?<div className="guest-welcome opening" role="status"><div className="opening-dots" aria-hidden="true"><span/><span/><span/></div><p>{t.opening}</p></div>:label?<div className="guest-welcome"><p>{t.welcome}</p><h2>{label}</h2><p>{locked?t.locked:selection?t.savedChoice:t.ready}</p>{selection&&<button className="outline welcome-order" onClick={openOrder}>{t.viewOrder}{selection.order_id?` · ${selection.order_id}`:''}</button>}<button className="text-button" disabled={busy} onClick={resetGuest}>{t.switchCode}</button></div>:<form onSubmit={e=>{e.preventDefault();void lookup()}}><label htmlFor="gift-code">{t.code}</label><div className="code-row"><input id="gift-code" required autoCapitalize="characters" autoComplete="off" maxLength={40} value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="primary" disabled={busy}>{busy?t.checking:t.check}</button></div><p className="fine">{t.codeHelp}</p></form>}{error&&!panel&&<p className="error" role="alert">{error}</p>}</section>
 
 <details id="guide" className="order-guide"><summary>{t.guide}</summary><ol>{t.steps.map((s,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{s}</p></li>)}</ol></details>
 {!config.open&&loaded&&<div className="draft-note">{t.preview}</div>}
 {loadError?<div className="notice" role="alert"><p>{t.serviceError}</p><p className="fine">{loadError}</p><button className="primary" onClick={load}>{t.retry}</button></div>:<section id="collection" aria-label={t.collection}><div className="filters">{[['All gifts',t.all],['Everyday',t.everyday],['For the table',t.table],['At home',t.home],['Saved',`♡ ${t.saved} (${saved.length})`]].map(([c,name])=><button aria-pressed={category===c} className={category===c?'active':''} key={c} onClick={()=>setCategory(c)}>{name}</button>)}</div>{saveNote&&<p className="save-note" role="status">{saveNote}</p>}{category==='Saved'&&!config.gifts.some(g=>g.enabled&&saved.includes(g.id))&&<p className="saved-empty">{t.savedEmpty}</p>}<div className="gift-grid">{config.gifts.filter(g=>g.enabled&&(category==='All gifts'||(category==='Saved'?saved.includes(g.id):g.category===category))).map((g,i)=><article className={`gift ${cart?.id===g.id?'is-chosen':''}`} key={g.id}><button type="button" className="heart" disabled={!verified} aria-pressed={saved.includes(g.id)} aria-label={`${saved.includes(g.id)?t.unsaveGift:t.saveGift}: ${g.brand} ${g.name}`} onClick={()=>toggleSaved(g.id)}><Heart size={20} aria-hidden="true"/></button><button className="media" aria-label={`${t.view}: ${g.brand} ${g.name}`} onClick={()=>{setDetail(g);setStage('detail');setPanel(true);setError('')}}><img src={g.image} srcSet={g.srcSet} sizes="(max-width:700px) 50vw, 25vw" alt={`${g.brand} ${g.name}`} loading={i<4?'eager':'lazy'} decoding="async" onError={imageFallback}/></button><div className="gift-caption"><span className="number">{String(i+1).padStart(2,'0')}</span><div><h2>{g.brand}</h2><p>{g.name}</p></div><div className="gift-actions"><button className="text-button" onClick={()=>{setDetail(g);setStage('detail');setPanel(true);setError('')}}>{t.view}</button><button className="primary" disabled={locked||!verified} onClick={()=>add(g)}>{cart?.id===g.id?<><Check size={16} aria-hidden="true"/> {t.added}</>:t.add}</button></div></div></article>)}</div></section>}
 <section className="closing"><h2>{t.one}</h2><p>{t.payment}</p>{config.deadline&&<p>{lang==='my'?'ရွေးချယ်ရန် နောက်ဆုံးရက် — ':'Choose by '}{new Date(config.deadline+'T00:00:00+09:00').toLocaleDateString(lang==='my'?'my-MM':'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Tokyo'})}</p>}</section></>}</main><footer><span>{t.thanks}</span></footer></div>
 {verified&&!panel&&<nav className="mobile-bar" aria-label={t.cart}><button type="button" className="mobile-bar-saved" onClick={()=>{setCategory('Saved');document.getElementById('collection')?.scrollIntoView({behavior:'smooth',block:'start'})}}>♡ {saved.length}</button><button type="button" className="primary mobile-bar-cart" onClick={openCart}><ShoppingBag size={17} aria-hidden="true"/>&nbsp;{cart?<>{t.barCart} · {t.barContinue}</>:t.cart}</button></nav>}
 <div className="toast-region" aria-live="polite">{toast&&<div className="toast" key={toast}>{toast}</div>}</div>
 <Dialog open={panel} onOpenChange={o=>{if(!busy){if(!o&&stage==='success')setCartGift(null);setPanel(o);setError('')}}}><DialogContent className={`gift-dialog ${lang==='my'?'burmese':''}`} lang={lang}><DialogTitle className="dialog-heading">{headings[stage]}</DialogTitle><DialogDescription>{stage==='detail'?detail?.name:label?t.giftFor.replace('{name}',label):t.codeHelp}</DialogDescription>
 {(stage==='cart'||stage==='delivery'||stage==='review')&&<ol className="stepper" aria-label={t.guide}>{([['cart',t.stepCart],['delivery',t.stepDelivery],['review',t.stepReview],['success',t.stepDone]] as const).map(([key,name],i,all)=>{const current=all.findIndex(a=>a[0]===stage);return <li key={key} className={i<current?'done':i===current?'current':''} aria-current={i===current?'step':undefined}><span className="dot" aria-hidden="true">{i<current?'✓':i+1}</span><span className="step-label">{name}</span></li>})}</ol>}
 {stage==='detail'&&detail&&<><img className="detail-image" src={detail.image} srcSet={detail.srcSet} sizes="(max-width:700px) 90vw, 560px" alt={`${detail.brand} ${detail.name}`} onError={imageFallback}/><h3>{detail.description}</h3><p>{detail.details}</p><p className="fine">{t.free}</p><p className="fine">{t.alternative}</p><div className="detail-actions"><button className="primary full" disabled={locked} onClick={()=>add()}>{locked?t.locked:t.add}</button><button type="button" className="outline full" aria-pressed={saved.includes(detail.id)} onClick={()=>toggleSaved(detail.id)}><Heart size={16} aria-hidden="true"/>&nbsp;{saved.includes(detail.id)?t.savedGift:t.saveGift}</button></div>{saveNote&&<p className="fine" role="status">{saveNote}</p>}</>}
 {stage==='cart'&&<>{cart?<>{summary}<p>{t.one}</p><button className="text-button" onClick={()=>{setCartGift(null);notify(t.toastRemoved)}}>{t.remove}</button>{!verified?<><p>{t.codeHelp}</p><form onSubmit={e=>{e.preventDefault();void lookup()}}><label>{t.code}<input required value={code} maxLength={40} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><button className="primary full" disabled={busy}>{busy?t.checking:t.check}</button></form></>:<button className="primary full" disabled={locked} onClick={startDelivery}>{locked?t.locked:t.checkout}</button>}<button className="outline full" onClick={()=>setPanel(false)}>{t.keepBrowsing}</button></>:<><p>{t.empty}</p><button className="primary full" onClick={()=>setPanel(false)}>{t.continue}</button></>}</>}
 {stage==='delivery'&&cart&&<form onSubmit={next} className="delivery-form" noValidate>{summary}
 <label>{t.recipient}<input id="field-recipient" value={form.recipient} onChange={e=>updateForm({...form,recipient:e.target.value})} autoComplete="name" maxLength={100} {...fieldProps('recipient')}/>{showError('recipient')}</label>
 <div className="form-row"><label>{t.email}<input id="field-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={e=>updateForm({...form,email:e.target.value})} maxLength={254} {...fieldProps('email')}/>{showError('email')}</label><label>{t.phone}<input id="field-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={e=>updateForm({...form,phone:e.target.value})} maxLength={40} {...fieldProps('phone')}/>{showError('phone')}</label></div>
 <label>{t.postal}<input id="field-postal" inputMode="numeric" autoComplete="postal-code" placeholder="123-4567" value={form.postal} onChange={e=>updateForm({...form,postal:e.target.value})} maxLength={8} {...fieldProps('postal')}/>{showError('postal')}</label>
 <label>{t.address}<textarea id="field-address" autoComplete="street-address" maxLength={600} placeholder={t.addressHelp} value={form.address} onChange={e=>updateForm({...form,address:e.target.value})} {...fieldProps('address')}/>{showError('address')}</label>
 <label>{t.note}<input value={form.note} onChange={e=>updateForm({...form,note:e.target.value})} maxLength={500}/></label>
 <label className="check-label"><Checkbox id="field-consent" checked={consent} onCheckedChange={v=>{setConsent(v===true);setTouched(x=>({...x,consent:true}))}} aria-invalid={!!(touched.consent&&errors.consent)}/><span>{t.consent}</span></label>{showError('consent')}
 <button className="primary full">{t.review}</button><button type="button" className="outline full" onClick={()=>setStage('cart')}>{t.back}</button></form>}
 {stage==='review'&&cart&&<>{summary}<dl className="order-review">{[[t.recipient,form.recipient],[t.email,form.email],[t.phone,form.phone],[t.postal,form.postal],[t.address,form.address],...(form.note?[[t.note,form.note]]:[])].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><p className="fine">{t.payment}</p><button className="primary full" disabled={busy||!config.open||ended} onClick={()=>void submit()}>{busy?t.saving:ended?t.ended:!config.open?t.closed:t.confirm}</button><button className="outline full" disabled={busy} onClick={()=>setStage('delivery')}>{t.back}</button></>}
 {stage==='success'&&cart&&<div className="success"><DeliveryScene label={t.inGoodHands}/><p className="success-badge"><CheckCircle2 size={20} aria-hidden="true"/>{t.successBadge}</p><p className="fine">{t.inGoodHands}</p>{selection?.order_id&&<p className="order-id">{t.orderId}: <strong>{selection.order_id}</strong></p>}{summary}<p>{selection?.status==='Requested'?t.received:t.locked}</p><p>{t.status}: {selection?.status==='Requested'?t.requested:selection?.status==='Ordered'?t.ordered:selection?.status==='Shipped'?t.shipped:selection?.status==='Delivered'?t.delivered:selection?.status}</p>{selection?.tracking&&<p>{t.track}: {selection.tracking}</p>}<div className="next-steps"><h4>{t.nextTitle}</h4><ol><li>{t.next1}</li><li>{t.next2}</li><li>{t.next3}</li></ol></div><p className="fine">{t.keep}</p>{emailStatus&&<p className="fine" role="status">{emailStatus==='sent'?(lang==='my'?'အတည်ပြုအီးမေးလ်ကို ပို့ပြီးပါပြီ။ သင့်အီးမေးလ်နှင့် spam ဖိုင်ကို စစ်ပေးပါ။':'A confirmation email has been sent. Check your inbox and spam folder.'):(lang==='my'?'ရွေးချယ်မှုကို သိမ်းပြီးပါပြီ။ အီးမေးလ်ပို့ဆောင်မှုကို မအတည်ပြုနိုင်သေးပါ။ ထပ်မမှာယူပါနှင့်။':'Your request is saved. Email delivery is not yet confirmed; you do not need to order again.')}</p>}<button className="primary full" onClick={()=>{finishOrder();openOrder()}}>{t.viewOrder}</button><button className="outline full" onClick={finishOrder}>{t.continue}</button></div>}
 {error&&!(error===t.fixErrors&&!Object.keys(errors).length)&&<p className="error" role="alert">{error}</p>}
 </DialogContent></Dialog></div>;
}
