import React from 'react';
import {describe,it,expect,afterEach,vi} from 'vitest';
import {render,screen,cleanup,fireEvent,act} from '@testing-library/react';
import {normalizeMathMarkdown} from '../utils/mathMarkdown';
import {scienceDiagramSchema,wantsIllustration} from '../utils/scienceDiagrams';
import {DocumentBlock} from '../components/DocumentBlock';
import {LabelledDiagram} from '../components/fln/LabelledDiagram';
import {ClassroomPanel} from '../components/ClassroomPanel';
import {queueBoardCall,type ClassroomContext} from '../server/cline/classroomTools';
import {generateAgentActionsCline} from '../server/cline/clineAdapter';
import type {AgentModel} from '@cline/shared';
import {useStore} from '../store';

afterEach(()=>{cleanup();vi.unstubAllGlobals();useStore.setState({warningLanguage:'en'});});
const context=(prompt:string):ClassroomContext=>({req:{prompt,lang:'en'},calls:[],citations:[],proposals:[],grounded:false,requiresGrounding:false,proposalOnly:false});
const widget=(ctx:ClassroomContext,type:string,config:any)=>queueBoardCall(ctx,'add_component',{componentType:type,gridPosition:'CENTER',configJson:JSON.stringify(config)});
describe('formulas and labelled illustrations',()=>{
 it('preserves Greek nu and other commands while normalizing math delimiters',()=>{
  const raw=String.raw`Frequency \(\nu\) and \[f(x)=\frac{a_0}{2}+\sum_{n=1}^{\infty}a_n\cos(nx)\]`;
  const result=normalizeMathMarkdown(raw);expect(result).toContain('$\\nu$');expect(result).toContain('$$\nf(x)=\\frac');expect(result).toContain('\\sum');
 });
 it('converts math fences but preserves executable/code text as code',()=>{
  expect(normalizeMathMarkdown('```latex\n\\frac{1}{2}\n```')).toContain('$$\n\\frac{1}{2}\n$$');
  const code='```js\nconst a="\\nu";\n```';expect(normalizeMathMarkdown(code)).toBe(code);
 });
 it('corrects over-escaped model commands and same-line display equations',()=>{
  const markdown=String.raw`$$f(x)=\\frac{a_0}{2}+\\sum_{n=1}^{\\infty}a_n\\cos(nx)$$`;
  const {container}=render(<DocumentBlock config={{markdown}}/>);
  expect(container.querySelector('.katex-display')).not.toBeNull();expect(container.querySelector('.katex-error')).toBeNull();
  expect(container.querySelector('annotation')?.textContent).toContain('\\frac');
  expect(container.querySelector('annotation')?.textContent).not.toContain('\\\\frac');
  expect(container.querySelector('.mfrac')).not.toBeNull();
 });
 it('renders the Fourier series, sum, integral and coefficient notation without KaTeX errors',()=>{
  const markdown=String.raw`\[f(x)=\frac{a_0}{2}+\sum_{n=1}^{\infty}\left(a_n\cos nx+b_n\sin nx\right)\]
\[a_n=\frac{1}{\pi}\int_{-\pi}^{\pi}f(x)\cos(nx)\,dx\]
Frequency \(\nu\).`;
  const {container}=render(<DocumentBlock config={{title:'Fourier series',markdown}}/>);
  expect(container.querySelectorAll('.katex')).toHaveLength(3);expect(container.querySelector('.katex-error')).toBeNull();
  expect(container.querySelectorAll('math')).toHaveLength(3);
 });
 it('renders double-escaped delimiters and commands as real fractions and Greek symbols',()=>{
  const markdown=String.raw`Frequency \\(\\nu\\). \\[f(x)=\\frac{a_0}{2}+\\sum_{n=1}^{\\infty}a_n\\cos(nx)\\]`;
  const {container}=render(<DocumentBlock config={{markdown}}/>);
  expect(container.querySelectorAll('.katex')).toHaveLength(2);
  expect(container.querySelectorAll('.katex-display')).toHaveLength(1);
  expect(container.querySelector('.mfrac')).not.toBeNull();
  expect(container.querySelector('.katex-error')).toBeNull();
  expect([...container.querySelectorAll('annotation')].map(node=>node.textContent)).toEqual([String.raw`\nu`,String.raw`f(x)=\frac{a_0}{2}+\sum_{n=1}^{\infty}a_n\cos(nx)`]);
 });
 it('preserves valid aligned and matrix row breaks instead of turning rows into commands',()=>{
  const markdown=String.raw`$$\begin{aligned}a&=1\\b&=2\end{aligned}$$
$$\begin{pmatrix}a&b\\c&d\end{pmatrix}$$`;
  const {container}=render(<DocumentBlock config={{markdown}}/>);
  expect(container.querySelectorAll('.katex-display')).toHaveLength(2);
  expect(container.querySelector('.katex-error')).toBeNull();
  expect(container.querySelectorAll('.mtable')).toHaveLength(2);
  expect(container.querySelector('annotation')?.textContent).toContain(String.raw`\\b`);
 });
 it('protects escaped currency, inline code, tilde fences and non-math LaTeX text',()=>{
  const code=String.raw`\(\nu\)`;
  const markdown='Prices \\$5 and \\$10. Inline ``'+code+'``.\n~~~js\n'+code+'\n~~~\nThe command \\nu is Greek nu.';
  expect(normalizeMathMarkdown(markdown)).toBe(markdown);
  const {container}=render(<DocumentBlock config={{markdown}}/>);
  expect(container.querySelector('.katex')).toBeNull();
  expect(container.querySelector('code')?.textContent).toBe(code);
 });
 it('keeps normalization stable when the server and board both process math',()=>{
  const raw=String.raw`Frequency \\(\\nu\\), and $$\\frac{1}{2}$$.`;
  const normalized=normalizeMathMarkdown(raw);
  expect(normalizeMathMarkdown(normalized)).toBe(normalized);
 });
 it('shows actionable formula errors while retaining source and other lesson content',()=>{
  const {container}=render(<DocumentBlock config={{markdown:'Keep teaching. $$\\frac{1}$$'}}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not render this formula');
  expect(screen.getByRole('alert')).toHaveTextContent('Check the LaTeX commands and braces');
  expect(screen.getByRole('alert').querySelector('code')?.textContent).toBe('\\frac{1}');
  expect(container).toHaveTextContent('Keep teaching.');
 });
 it('localizes formula warnings while preserving technical details and source',()=>{
  useStore.setState({warningLanguage:'hi'});
  render(<DocumentBlock config={{markdown:'$$\\frac{1}$$'}}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('समस्या हुई। नीचे विवरण देखें।');
  expect(screen.getByRole('alert')).toHaveTextContent('Check the LaTeX commands and braces');
  expect(screen.getByRole('alert').querySelector('code')?.textContent).toBe('\\frac{1}');
 });
 it('rejects invalid math before it can be published to the board',()=>{
  expect(()=>widget(context('Show Fourier formulas'),'DOCUMENT_PAGE',{markdown:'$$\\frac{1}$$'})).toThrow(/invalid LaTeX/);
 });
 it('never renders a photosynthesis fallback for digestive anatomy',()=>{
  const {container}=render(<LabelledDiagram config={{template:'digestive-system',lang:'en'}}/>);
  expect(screen.getByRole('img',{name:'Human digestive system'})).toBeInTheDocument();
  expect(screen.getByText('Stomach')).toBeInTheDocument();expect(screen.getByText('Small intestine')).toBeInTheDocument();
  expect(screen.queryByText('Sunlight')).not.toBeInTheDocument();expect(container.querySelector('[data-template="digestive-system"]')).not.toBeNull();
 });
 it('draws the water-cycle scene rather than a plant',()=>{
  render(<LabelledDiagram config={{template:'water-cycle',lang:'en'}}/>);
  expect(screen.getByText('Precipitation')).toBeInTheDocument();expect(screen.queryByText('Glucose (food)')).not.toBeInTheDocument();
 });
 it('reports unknown templates honestly without drawing another topic',()=>{
  const {container}=render(<LabelledDiagram config={{template:'respiratory-system',title:'Lungs'}}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('unsupported');expect(container.querySelector('svg')).toBeNull();
 });
 it('gives duplicate illustrations unique accessible SVG IDs',()=>{
  const {container}=render(<><LabelledDiagram config={{template:'photosynthesis'}}/><LabelledDiagram config={{template:'photosynthesis'}}/></>);
  const ids=[...container.querySelectorAll('[id]')].map(e=>e.id);expect(new Set(ids).size).toBe(ids.length);
 });
 it('rejects an unrelated template on the server',()=>{
  expect(()=>widget(context('Picture of digestive system'),'LABELLED_DIAGRAM',{template:'photosynthesis'})).toThrow(/digestive-system/);
 });
 it('requires a custom illustration for other anatomy instead of silently picking a plant',()=>{
  expect(()=>widget(context('Draw a labelled diagram of lungs'),'LABELLED_DIAGRAM',{template:'photosynthesis',title:'Lungs'})).toThrow(/no matching built-in/);
 });
 it('does not silently treat missing template as photosynthesis',()=>{
  expect(()=>widget(context('Create a labelled diagram'),'LABELLED_DIAGRAM',{title:'Diagram'})).toThrow();
 });
 it('validates illustration updates targeted by title as well as ID',()=>{
  const ctx=context('Update the digestive system diagram');ctx.req.domElements={d:{componentType:'LABELLED_DIAGRAM',config:{title:'Digestion',template:'digestive-system'}}};
  expect(()=>queueBoardCall(ctx,'update_component',{componentTitle:'Digestion',action:'UPDATE_CONFIG',configJson:'{"template":"photosynthesis"}'})).toThrow(/digestive-system/);
  expect(()=>queueBoardCall(ctx,'update_component',{objectId:'d',action:'UPDATE_CONFIG',configJson:'{"description":"Updated notes"}'})).not.toThrow();
 });
 it('rejects Mermaid when a teacher asks for an illustration',()=>{
  expect(()=>queueBoardCall(context('Draw a digestive system diagram'),'render_mermaid',{code:'flowchart TD\n A-->B',gridPosition:'CENTER'})).toThrow(/not a flowchart/);
 });
 it('allows explicitly requested flowcharts and concept maps',()=>{
  expect(wantsIllustration('Draw a water cycle diagram, not a flowchart')).toBe(true);
  expect(wantsIllustration('Draw a digestive system flowchart diagram')).toBe(false);
  expect(()=>queueBoardCall(context('Digestive system flowchart'),'render_mermaid',{code:'flowchart TD\n A-->B',gridPosition:'CENTER'})).not.toThrow();
 });
 it('supports bounded vector illustrations without arbitrary SVG or JavaScript',()=>{
  expect(scienceDiagramSchema.safeParse({template:'custom',shapes:[{kind:'ellipse',x:350,y:200,rx:80,ry:40,fill:'#fda4af'}]}).success).toBe(true);
  expect(scienceDiagramSchema.safeParse({template:'custom',shapes:[{kind:'path',d:'<script>alert(1)</script>'}]}).success).toBe(false);
  expect(scienceDiagramSchema.safeParse({template:'custom'}).success).toBe(false);
 });
 it('executes the dedicated diagram tool in the actual SDK loop',async()=>{
  let turn=0;const model:AgentModel={async *stream(){if(turn++===0){yield {type:'tool-call-delta',toolCallId:'diagram',toolName:'render_science_diagram',input:{template:'digestive-system',title:'Human digestion',lang:'en'}};yield {type:'finish',reason:'tool-calls'};}else{yield {type:'text-delta',text:'Illustration ready.'};yield {type:'finish',reason:'stop'};}}};
  const r=await generateAgentActionsCline({prompt:'Draw a picture of digestive system',lang:'en'},model);
  expect(r.functionCalls).toHaveLength(1);expect(JSON.parse(r.functionCalls[0].args.configJson).template).toBe('digestive-system');
 });
 it('executes the dedicated formula tool and keeps valid LaTeX',async()=>{
  let turn=0;const model:AgentModel={async *stream(){if(turn++===0){yield {type:'tool-call-delta',toolCallId:'math',toolName:'render_math_note',input:{title:'Fourier',markdown:String.raw`\[a_n=\frac{1}{\pi}\int_{-\pi}^{\pi}f(x)\cos(nx)\,dx\]`}};yield {type:'finish',reason:'tool-calls'};}else{yield {type:'text-delta',text:'Formula ready.'};yield {type:'finish',reason:'stop'};}}};
  const r=await generateAgentActionsCline({prompt:'Fourier coefficients',lang:'en'},model);
  expect(r.functionCalls[0].args.componentType).toBe('DOCUMENT_PAGE');expect(JSON.parse(r.functionCalls[0].args.configJson).markdown).toContain('$$');
 });
 it('offers a discoverable typed request and concise examples in classroom controls',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({chapters:[]})));useStore.setState({isThinking:false,isActing:false,actionQueue:[]});
  const onPrompt=vi.fn();render(<ClassroomPanel activeChapter={null} onChapterChange={vi.fn()} boardLanguage="en" onBoardLanguageChange={vi.fn()} lessonMode="standard" onLessonModeChange={vi.fn()} proposals={[]} onApprove={vi.fn()} onReject={vi.fn()} onPrompt={onPrompt} onReadBoard={vi.fn()} onUndo={vi.fn()} highContrast={false} onHighContrastChange={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:/Classroom tools/}));
  fireEvent.change(screen.getByLabelText('What would you like to teach?'),{target:{value:'Explain Fourier series'}});
  fireEvent.click(screen.getByRole('button',{name:'Create on board'}));expect(onPrompt).toHaveBeenCalledWith('Explain Fourier series');
  expect(screen.queryByLabelText('What would you like to teach?')).not.toBeInTheDocument();
  await act(async()=>{await Promise.resolve();});
 });
});