import React,{useId} from 'react';
import type { SupportedLanguage } from '../../types';
import {scienceDiagramSchema,requestedDiagramTemplate,type ScienceDiagramConfig} from '../../utils/scienceDiagrams';
export function LabelledDiagram({config,lang='hi',readOnly=false}:{config:any;lang?:SupportedLanguage;readOnly?:boolean}) {
  const id=useId().replace(/:/g,'');
  const parsed=scienceDiagramSchema.safeParse(config);
  if(!parsed.success||(requestedDiagramTemplate(config?.title||'')&&requestedDiagramTemplate(config.title)!==parsed.data.template))return <section role="alert" className="p-6 h-full bg-amber-50 text-amber-950"><h2 className="font-semibold text-lg">Illustration unavailable</h2><p className="mt-2">This illustration has an unsupported, missing or mismatched template. Ask for the diagram again; no unrelated image has been substituted.</p></section>;
  const c=parsed.data;const hi=(c.lang||lang)==='hi';
  const defaults=c.template==='digestive-system'?[hi?'मानव पाचन तंत्र':'Human digestive system',hi?'मुख से भोजन अन्ननली, आमाशय, छोटी आँत और बड़ी आँत से होकर गुजरता है। यकृत और अग्न्याशय पाचन में मदद करते हैं।':'Food travels from the mouth through the oesophagus, stomach, small intestine and large intestine. The liver and pancreas assist digestion.']
    :c.template==='water-cycle'?[hi?'जल चक्र':'The water cycle',hi?'सूर्य की गर्मी से पानी वाष्प बनता है। बादल संघनन से बनते हैं और वर्षा से पानी धरती पर लौटता है।':'Sunlight drives evaporation. Water vapour condenses into clouds, and precipitation returns water to the land and ocean.']
    :c.template==='photosynthesis'?[hi?'प्रकाश संश्लेषण':'Photosynthesis',hi?'पौधे सूर्य के प्रकाश, पानी और कार्बन डाइऑक्साइड से भोजन बनाते हैं और ऑक्सीजन छोड़ते हैं।':'Plants use sunlight, water and carbon dioxide to make food and release oxygen.']
    :[hi?'वैज्ञानिक चित्र':'Science illustration','Simplified educational vector illustration.'];
  const title=c.title||defaults[0];const description=c.description||defaults[1];
  const label=(key:string,en:string,hindi:string)=>c.labels?.[key]||(hi?hindi:en);
  const arrow=`arrow-${id}`;
  return <section className="science-illustration h-full overflow-auto bg-white p-5 text-slate-900" lang={c.lang||lang} data-template={c.template}>
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold tracking-tight">{title}</h2><span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-700">Illustration</span></div>
    <svg viewBox={c.template==='digestive-system'?'0 0 720 570':'0 0 720 480'} role="img" aria-labelledby={`title-${id}`} aria-describedby={`desc-${id}`} className="w-full rounded-xl bg-slate-50/70">
      <title id={`title-${id}`}>{title}</title><desc id={`desc-${id}`}>{description}</desc>
      <defs><marker id={arrow} markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#64748b"/></marker></defs>
      {c.template==='digestive-system'&&<>
        <path d="M316 64 C303 26 382 20 394 64 L385 123 C422 142 470 159 469 224 L453 481 Q356 540 257 480 L239 224 C239 165 281 141 316 123 Z" fill="#fce7da" stroke="#e7c2af" strokeWidth="2"/>
        <path d="M336 73 Q352 84 370 74" fill="none" stroke="#be123c" strokeWidth="8" strokeLinecap="round"/>
        <path d="M351 81 L351 185 Q352 209 368 226" fill="none" stroke="#fb923c" strokeWidth="13"/>
        <path d="M374 220 C391 203 419 214 426 241 C440 280 419 317 384 308 C359 301 354 278 358 255 Z" fill="#fda4af" stroke="#e11d48" strokeWidth="3"/>
        <path d="M264 230 Q300 198 350 220 L364 255 Q302 272 261 253 Z" fill="#b45309" stroke="#92400e" strokeWidth="2"/>
        <ellipse cx="327" cy="268" rx="11" ry="17" fill="#65a30d"/>
        <path d="M351 315 Q397 300 431 318 Q404 334 354 326 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="2"/>
        <path d="M288 451 L282 357 Q286 337 308 337 L422 337 Q439 340 439 362 L438 432 Q433 454 410 458 L382 477 L364 507" fill="none" stroke="#c084fc" strokeWidth="20" strokeLinecap="round"/>
        <path d="M320 358 C409 344 418 380 329 375 C286 380 321 399 403 392 C440 395 408 416 322 410 C284 417 316 442 390 429" fill="none" stroke="#fb923c" strokeWidth="13" strokeLinecap="round"/>
        <path d="M364 500 L364 524" stroke="#a855f7" strokeWidth="12" strokeLinecap="round"/>
        <g fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M339 77 H164 M351 156 H160 M290 236 H162 M326 270 L185 291 M306 381 H166 M376 260 H534 M404 319 H533 M439 407 H533 M364 504 L530 516"/></g>
        <g fontSize="19" fill="#334155" fontWeight="500"><text x="35" y="82">{label('mouth','Mouth','मुख')}</text><text x="35" y="161">{label('oesophagus','Oesophagus','अन्ननली')}</text><text x="35" y="240">{label('liver','Liver','यकृत')}</text><text x="35" y="296">{label('gallbladder','Gallbladder','पित्ताशय')}</text><text x="35" y="386">{label('smallIntestine','Small intestine','छोटी आँत')}</text><text x="541" y="265">{label('stomach','Stomach','आमाशय')}</text><text x="541" y="324">{label('pancreas','Pancreas','अग्न्याशय')}</text><text x="541" y="412">{label('largeIntestine','Large intestine','बड़ी आँत')}</text><text x="541" y="520">{label('rectum','Rectum / anus','मलाशय / गुदा')}</text></g>
      </>}
      {c.template==='photosynthesis'&&<>
        <circle cx="110" cy="95" r="40" fill="#fbbf24"/><g stroke="#fbbf24" strokeWidth="4"><path d="M110 30 V15 M110 160 V175 M45 95 H30 M175 95 H190 M62 47 L51 36 M160 145 L172 157"/></g>
        <path d="M370 402 L370 156" stroke="#15803d" strokeWidth="13"/>
        <path d="M369 251 Q259 141 237 226 Q279 292 369 251 M370 305 Q477 208 486 290 Q448 345 370 305" fill="#4ade80" stroke="#16a34a" strokeWidth="2"/>
        <path d="M369 393 L336 429 M369 393 L398 431 M369 399 L369 443" stroke="#a16207" strokeWidth="6"/>
        <path d="M60 450 Q340 438 640 451" fill="none" stroke="#cbd5e1" strokeWidth="3"/>
        <g fill="none" stroke="#64748b" strokeWidth="2.5" markerEnd={`url(#${arrow})`}><path d="M158 125 L281 214 M136 293 L278 274 M374 423 L374 332 M451 248 L565 187"/></g>
        <g fontSize="19" fill="#334155"><text x="29" y="195">{label('sun','Sunlight','सूर्य का प्रकाश')}</text><text x="20" y="331">{label('co2','Carbon dioxide','कार्बन डाइऑक्साइड')}</text><text x="465" y="165">{label('o2','Oxygen released','ऑक्सीजन')}</text><text x="395" y="423">{label('water','Water from roots','जड़ों से पानी')}</text><text x="430" y="370">{label('glucose','Glucose (food)','ग्लूकोज़ (भोजन)')}</text></g>
      </>}
      {c.template==='water-cycle'&&<>
        <rect x="0" y="361" width="720" height="119" fill="#bae6fd"/><path d="M344 370 L490 183 L644 369" fill="#cbd5e1"/><path d="M450 235 L490 183 L535 236 L506 221 L486 235 L473 219 Z" fill="white"/>
        <path d="M0 387 Q95 369 180 386 T354 384" fill="none" stroke="#38bdf8" strokeWidth="3"/>
        <circle cx="90" cy="93" r="38" fill="#fbbf24"/>
        <path d="M301 132 C265 114 276 76 312 82 C323 49 370 55 377 86 C413 71 442 112 418 132 Z" fill="white" stroke="#94a3b8" strokeWidth="2"/>
        <g fill="none" stroke="#0284c7" strokeWidth="3" markerEnd={`url(#${arrow})`}><path d="M133 343 Q125 249 220 176 M235 136 L270 117 M399 153 L443 236 M575 347 Q552 412 303 414"/></g>
        <g stroke="#60a5fa" strokeWidth="3"><path d="M347 162 L338 185 M377 157 L368 181 M405 166 L397 190"/></g>
        <g fill="#334155" fontSize="20"><text x="22" y="241">{label('evaporation','Evaporation','वाष्पीकरण')}</text><text x="264" y="35">{label('condensation','Condensation','संघनन')}</text><text x="440" y="150">{label('precipitation','Precipitation','वर्षा')}</text><text x="383" y="450">{label('collection','Collection & runoff','संचय और बहाव')}</text></g>
      </>}
      {c.template==='custom'&&c.shapes?.map((s,index)=><VectorShape key={index} shape={s}/>)}
    </svg>
    <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    <p className="mt-2 text-[11px] text-slate-400">{hi?'सरलीकृत शैक्षिक चित्र · वास्तविक अनुपात में नहीं':'Simplified educational illustration · not to scale'}</p>
  </section>;
}
function VectorShape({shape:s}:{shape:NonNullable<ScienceDiagramConfig['shapes']>[number]}) {
 const style={fill:s.fill,stroke:s.stroke,strokeWidth:s.strokeWidth};
 switch(s.kind){
  case 'path':return <path d={s.d} {...style}/>;
  case 'ellipse':return <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} {...style}/>;
  case 'circle':return <circle cx={s.x} cy={s.y} r={s.r} {...style}/>;
  case 'rect':return <rect x={s.x} y={s.y} width={s.width} height={s.height} rx="8" {...style}/>;
  case 'line':return <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} {...style}/>;
  case 'text':return <text x={s.x} y={s.y} fontSize={s.fontSize} fill={s.fill==='none'?'#334155':s.fill}>{s.text}</text>;
 }
}