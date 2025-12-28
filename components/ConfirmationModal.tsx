
import React from 'react';
import { useTranslation } from '../utils/i18n';

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onConfirm, onCancel, title, message }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-scp-dark border-2 border-scp-accent w-full max-w-md shadow-[0_0_30px_rgba(195,46,46,0.3)] relative overflow-hidden">
        {/* Striped warning header */}
        <div className="bg-scp-accent/20 h-8 w-full flex items-center px-4 border-b border-scp-accent relative">
           <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#c32e2e_10px,#c32e2e_20px)]"></div>
           <span className="font-mono text-scp-accent font-bold text-xs tracking-widest relative z-10">{t('modal.warning')}</span>
        </div>

        <div className="p-6 text-center">
          <h3 className="font-report text-2xl text-scp-text mb-4 text-shadow-sm">{title}</h3>
          <p className="font-mono text-sm text-gray-300 mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 border border-scp-gray bg-scp-gray/10 text-gray-300 hover:text-white hover:bg-scp-gray/30 hover:border-gray-300 font-mono text-xs transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2 border border-scp-accent text-scp-accent hover:bg-scp-accent hover:text-white font-mono text-xs font-bold shadow-[0_0_10px_rgba(195,46,46,0.2)] hover:shadow-[0_0_20px_rgba(195,46,46,0.6)] transition-all"
            >
              {t('modal.confirm')}
            </button>
          </div>
        </div>
        
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-scp-accent"></div>
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-scp-accent"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-scp-accent"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-scp-accent"></div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
