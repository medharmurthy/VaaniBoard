import { z } from 'zod';
import { generateToolContentCline } from '../../server/cline/toolContent';
import { resolveProvider, providerRequestSchema } from '../../server/cline/providers';
import { classifyClassroomError } from '../../server/cline/runtimeHealth';
export default async function handler(req:any,res:any) {
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  const parsed=providerRequestSchema.extend({toolId:z.enum(['mindmap','quiz','summary']),prompt:z.string().trim().min(1).max(30000)}).passthrough().safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Invalid teaching content request.',code:'invalid_request',retryable:false});
  let providerId: string | undefined;
  try{providerId=resolveProvider(parsed.data).providerId;return res.json({result:await generateToolContentCline(parsed.data),engine:'cline',provider:providerId});}
  catch(error){const {status,...failure}=classifyClassroomError(error,providerId);return res.status(status).json(failure);}
}
