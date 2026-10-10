import { classroomRuntimeStatus } from '../../server/cline/runtimeHealth';
export default function handler(req:any,res:any) {
  return res.json(classroomRuntimeStatus(req.body||{}));
}
