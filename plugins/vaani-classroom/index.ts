import type { AgentPlugin } from '@cline/sdk';
import { createClassroomTools } from '../../server/cline/classroomTools';
/** Knowledge-only plugin: no shell or mutable board tools for curriculum content teams. */
const plugin: AgentPlugin = {
  name:'vaani-classroom',manifest:{capabilities:['tools','rules']},
  setup(api) {
    const tools = createClassroomTools({req:{},calls:[],citations:[],proposals:[],grounded:false,requiresGrounding:true,proposalOnly:true});
    for (const tool of tools.filter(t=>['search_syllabus','get_chapter_exercises','get_nipun_targets','generate_math_practice','get_varnamala'].includes(t.name))) api.registerTool(tool);
    api.registerRule({id:'vaani-grounding',content:'Search NCERT before curriculum answers. Cite printed page numbers. Never invent textbook exercises or official NIPUN targets.'});
  },
};
export default plugin;