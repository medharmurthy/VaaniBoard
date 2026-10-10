import { generateAgentActionsCline } from '../../server/cline/clineAdapter';
import { resolveLocalClassroomCommand } from '../../server/cline/localClassroomCommands';
import { classifyClassroomError } from '../../server/cline/runtimeHealth';
import { resolveProvider } from '../../server/cline/providers';
export default async function handler(req:any,res:any) {
  if(req.method!=='POST')return res.status(405).json({error:'POST required'});
  if(typeof req.body?.prompt!=='string'||req.body.prompt.length>120000)return res.status(400).json({error:'Invalid prompt'});
  let providerId: string | undefined;
  try {const local=resolveLocalClassroomCommand(req.body);if(!local)providerId=resolveProvider(req.body).providerId;return res.json(local||await generateAgentActionsCline(req.body));}
  catch (error) {const {status,...failure}=classifyClassroomError(error,providerId);return res.status(status).json(failure);}
}
