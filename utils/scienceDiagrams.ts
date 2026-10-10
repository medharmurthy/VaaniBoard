import {z} from 'zod';

const coordinate=z.number().finite().min(0).max(1000);
const color=z.string().regex(/^(#[0-9a-fA-F]{3,8}|none)$/);
export const diagramShapeSchema=z.object({
  kind:z.enum(['path','ellipse','circle','rect','line','text']),
  x:coordinate.optional(),y:coordinate.optional(),x2:coordinate.optional(),y2:coordinate.optional(),
  width:coordinate.optional(),height:coordinate.optional(),rx:coordinate.optional(),ry:coordinate.optional(),r:coordinate.optional(),
  d:z.string().max(4000).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9.,+\-\s]+$/).optional(),
  text:z.string().max(120).optional(),fill:color.default('none'),stroke:color.default('#475569'),
  strokeWidth:z.number().min(0).max(16).default(2),fontSize:z.number().min(12).max(40).default(20),
}).superRefine((shape,ctx)=>{
  const required=shape.kind==='path'?['d']:shape.kind==='ellipse'?['x','y','rx','ry']:shape.kind==='circle'?['x','y','r']:shape.kind==='rect'?['x','y','width','height']:shape.kind==='line'?['x','y','x2','y2']:['x','y','text'];
  for(const key of required)if(shape[key as keyof typeof shape]===undefined)ctx.addIssue({code:'custom',message:`${shape.kind} needs ${key}`});
});
export const scienceDiagramSchema=z.object({
  template:z.enum(['digestive-system','photosynthesis','water-cycle','custom']),
  title:z.string().trim().min(1).max(160).optional(),description:z.string().max(2000).optional(),lang:z.string().optional(),
  labels:z.record(z.string(),z.string().max(100)).optional(),
  shapes:z.array(diagramShapeSchema).min(1).max(60).optional(),
}).passthrough().superRefine((config,ctx)=>{if(config.template==='custom'&&!config.shapes?.length)ctx.addIssue({code:'custom',message:'Custom illustrations require vector shapes. Do not substitute an unrelated template.'});});
export type ScienceDiagramConfig=z.infer<typeof scienceDiagramSchema>;
export function requestedDiagramTemplate(prompt:string) {
  if(/digestive|digestion|पाचन|pachan/i.test(prompt))return 'digestive-system';
  if(/photosynthesis|प्रकाश\s*संश्लेषण|prakash\s*sanshleshan/i.test(prompt))return 'photosynthesis';
  if(/water\s*cycle|जल\s*चक्र|paani.*chakra/i.test(prompt))return 'water-cycle';
  return undefined;
}
export function wantsIllustration(prompt:string) {
  const positive=prompt.replace(/(?:not|no|without|instead of|rather than)\s+(?:a\s+)?flow\s*chart/gi,'');
  return /diagram|picture|illustrat|anatom|drawing|sketch|चित्र|आरेख/i.test(prompt) && !/flow\s*chart|flowchart|mind\s*map|mindmap|concept\s*map|timeline|sequence/i.test(positive);
}