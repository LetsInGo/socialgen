import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
type Photo={data:string;mimeType:string};
const subjects=["Event","City","Venue","Industry","Other"] as const;
export default function BackgroundPage(){
 const [entry,setEntry]=useState(""),[event,setEvent]=useState<any>(null),[name,setName]=useState(""),[tag,setTag]=useState("");
 const [subject,setSubject]=useState<string>("Event"),[description,setDescription]=useState(""),[photos,setPhotos]=useState<Photo[]>([]),[selected,setSelected]=useState<Photo|null>(null);
 const [results,setResults]=useState<Photo[]>([]),[choice,setChoice]=useState<Photo|null>(null),[stage,setStage]=useState("pick"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirmed,setConfirmed]=useState(false);
 async function request(path:string,body:any){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||"Please retry.");return d;}
 async function find(){setBusy(true);setError("");setEvent(null);setSelected(null);setResults([]);setChoice(null);setConfirmed(false);setPhotos([]);setStage("pick");try{const input=entry.trim();const url=input.includes("@")?input.split("@").pop():input;const d=await request("/api/scrape-event",{url});setEvent(d);setName(d.eventName);setTag(d.hashtag||"");setPhotos(d.referenceImages||[]);}catch(e){setError(String(e));}finally{setBusy(false);}}
 async function generate(){setBusy(true);setError("");setStage("results");setResults([]);setChoice(null);
 const config={...event,industry:event.industry||"Other",aspectRatio:"16:9",style:"photorealistic",primaryColor:event.primaryColor||"#ffffff",backgroundOnly:true,backgroundSubject:subject,referenceImage:selected||undefined,customPrompt:name+". "+description,model:"gemini-2.5-flash-image"};
 await Promise.all([0,1].map(async i=>{try{const d=await request("/api/generate",{...config,customPrompt:config.customPrompt+(i?". Wide environmental perspective.":". Closer editorial perspective.")});setResults(old=>[...old,{data:d.imageData,mimeType:d.mimeType}]);}catch(e){setError(String(e));}}));setBusy(false);}
 const src=(p:Photo)=>"data:"+p.mimeType+";base64,"+p.data;
 return <div className="max-w-6xl mx-auto p-5 space-y-5">
 <p className="text-sm text-muted-foreground">1 Background · 2 Brand treatment · 3 Event identity · 4 Personalization</p>
 <h1 className="text-2xl font-semibold">Choose your background</h1>
 {!event&&<form onSubmit={e=>{e.preventDefault();void find();}} className="flex gap-2"><Input aria-label="Email or event website" placeholder="Your email or event website" value={entry} onChange={e=>setEntry(e.target.value)} required/><Button disabled={busy}>{busy?"Finding your event…":"Find my event"}</Button></form>}
 {error&&<p role="alert" className="text-red-500">{error}</p>}
 {event&&stage==="pick"&&<>
 <div className="max-w-lg space-y-2"><label className="block">Your event<Input value={name} onChange={e=>{setName(e.target.value);setConfirmed(false);}}/></label><label className="block">Event hashtag (optional)<Input value={tag} onChange={e=>{setTag(e.target.value);setConfirmed(false);}}/></label><Button variant="outline" onClick={()=>setConfirmed(true)} disabled={!name.trim()}>{confirmed?"Confirmed":"Confirm event and hashtag"}</Button></div>
 <div className="flex flex-wrap gap-2">{subjects.map(s=><Button key={s} variant={subject===s?"default":"outline"} onClick={()=>{setSubject(s);setSelected(null);}}>{s}</Button>)}</div>
 <Input aria-label="Background direction" placeholder={subject==="Other"?"Describe your background":"Optional direction for your "+subject.toLowerCase()+" background"} value={description} onChange={e=>setDescription(e.target.value)}/>
 <div className="grid md:grid-cols-[1fr_220px] gap-6">
 <section><h2 className="font-semibold mb-2">Select a reference photo</h2><p className="text-sm text-muted-foreground mb-3">We use the photo as inspiration for a new background.</p>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{(subject==="Event"?photos:[]).map((p,i)=><button key={i} aria-label={"Select reference "+(i+1)} aria-pressed={selected===p} onClick={()=>setSelected(p)} className={"rounded-lg overflow-hidden border-2 "+(selected===p?"border-primary":"border-transparent")}><img src={src(p)} alt="Event website reference" className="w-full h-36 object-cover"/></button>)}</div>
 <label className="block mt-4">Upload a reference<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5000000){setError("Choose a photo under 5 MB.");return;}const reader=new FileReader();reader.onload=()=>{const p={data:String(reader.result).split(",")[1],mimeType:f.type};setSelected(p);};reader.readAsDataURL(f);}}/></label>
 {!selected&&<p className="text-sm mt-3">You can also generate directly from your selected subject.</p>}</section>
 <aside className="border rounded-lg p-3 space-y-3 h-fit"><h2 className="text-sm font-semibold">Reference preview</h2>{selected?<img src={src(selected)} alt="Selected reference" className="w-full max-h-36 object-contain"/>:<p className="text-sm text-muted-foreground">Select a photo to preview it here.</p>}<Button className="w-full" disabled={busy||!confirmed||(subject==="Other"&&!description.trim())||(subject==="City"&&!event.city)||(subject==="Venue"&&!event.venue)} onClick={()=>void generate()}>Generate backgrounds</Button>{subject==="City"&&<Input value={event.city||""} placeholder="Enter city" onChange={e=>setEvent({...event,city:e.target.value})}/>} {subject==="Venue"&&<Input value={event.venue||""} placeholder="Enter venue" onChange={e=>setEvent({...event,venue:e.target.value})}/>}</aside></div>
 </>}
 {event&&stage==="results"&&<><Button variant="outline" disabled={busy} onClick={()=>setStage("pick")}>Change reference</Button><h2 className="text-xl">Your background options</h2>{busy&&<p role="status">Creating backgrounds. Options appear as they finish…</p>}<div className="grid md:grid-cols-2 gap-4">{results.map((p,i)=><button key={i} aria-label={"Choose background "+(i+1)} aria-pressed={choice===p} onClick={()=>setChoice(p)} className={"border-2 rounded-lg overflow-hidden "+(choice===p?"border-primary":"border-transparent")}><img src={src(p)} alt={"Background option "+(i+1)} /></button>)}</div>{choice&&<div className="space-y-2"><p>Background selected. Brand treatment is the next step we will build.</p><a download="event-background.png" href={src(choice)} className="underline">Download background</a></div>}{!busy&&<Button onClick={()=>void generate()}>Generate another pair</Button>}</>}
 </div>;
}
