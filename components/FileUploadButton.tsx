import React, { useRef, useState } from 'react';
import { useStore } from '../store';
import { Paperclip, Loader2 } from 'lucide-react';
import { parseDocumentFile } from '../utils/documentParser';
import { toast } from '../utils/toast';
import { sounds } from '../utils/sounds';

interface FileUploadButtonProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  disabled?: boolean;
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({ 
  className, 
  icon = <Paperclip size={18} />, 
  title = "Upload a file, document or image",
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    toast.info(`Reading "${file.name}"...`);

    try {
      const attached = await parseDocumentFile(file);
      useStore.getState().setAttachedDocument(attached);

      let logMsg = `[File attached: ${file.name}]`;
      if (attached.category === 'pdf') {
        logMsg = `[PDF attached: ${file.name} (${attached.pageCount || 1} pages, ${(file.size / 1024).toFixed(1)} KB)]`;
      } else if (attached.category === 'image') {
        logMsg = `[Image attached: ${file.name}]`;
      } else {
        logMsg = `[Document attached: ${file.name} (${attached.category.toUpperCase()}, ${(file.size / 1024).toFixed(1)} KB)]`;
      }

      useStore.getState().addMessage({ role: 'user', text: logMsg });
      useStore.getState().addLog(`Document ready for analysis: ${file.name}`);
      sounds.play('click');
      toast.success(`"${file.name}" is ready for analysis.`);
    } catch (err: any) {
      console.error('Error parsing document:', err);
      toast.error(`Could not read the file: ${err.message || 'Unknown format'}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <button 
        type="button" 
        onClick={() => fileInputRef.current?.click()} 
        disabled={disabled || isProcessing}
        className={`${className || "text-slate-400 hover:text-blue-500 transition-colors p-2 rounded-xl hover:bg-blue-50"} ${(disabled || isProcessing) ? 'opacity-40 pointer-events-none' : ''}`} 
        title={title}
      >
        {isProcessing ? <Loader2 size={18} className="animate-spin text-blue-600" /> : icon}
      </button>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.markdown,.csv,.tsv,.json,.js,.ts,.jsx,.tsx,.py,.html,.css,.xml,.yaml,.yml,.log"
      />
    </>
  );
};
