import React from 'react';
import CustomSelect from '../common/CustomSelect';
import GameButton from '../common/GameButton';

interface FieldProps {
    label: React.ReactNode;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, required, error, children }) => (
    <div className={`fld ${error ? 'err' : ''}`}>
        <label>{label}{required && <span className="req">*</span>}</label>
        {children}
        {error && <div className="fld-err">{error}</div>}
    </div>
);

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label: React.ReactNode;
    value: string | number;
    onChange: (value: string) => void;
    mono?: boolean;
    required?: boolean;
    error?: string;
}

export const TextField: React.FC<TextFieldProps> = ({ label, onChange, mono, required, error, type = 'text', ...rest }) => (
    <Field label={label} required={required} error={error}>
        <input type={type} className={mono ? 'mono' : undefined} onChange={event => onChange(event.target.value)} {...rest} />
    </Field>
);

interface AreaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
    label: React.ReactNode;
    value: string;
    onChange: (value: string) => void;
    height?: number;
}

export const AreaField: React.FC<AreaFieldProps> = ({ label, onChange, height = 78, ...rest }) => (
    <Field label={label}>
        <textarea style={{ height }} onChange={event => onChange(event.target.value)} {...rest} />
    </Field>
);

interface SelectFieldProps {
    label: string;
    value: string;
    options: { value: string; label: string; hint?: string }[];
    onChange: (value: string) => void;
}

export const SelectField: React.FC<SelectFieldProps> = ({ label, value, options, onChange }) => (
    <Field label={label}>
        <CustomSelect variant="stage" ariaLabel={label} value={value} options={options} onChange={onChange} />
    </Field>
);

interface ImageSlotProps {
    url?: string;
    /** CSS aspect ratio of the frame */
    ratio: string;
    generating?: boolean;
    disabled?: boolean;
    labels: { generate: string; upload: string; delete: string; empty: string; generating: string };
    onGenerate: () => void;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onDelete: () => void;
    onZoom: (url: string) => void;
    /** Buttons go above the frame when the prompt box is above it too */
    actionsFirst?: boolean;
}

export const ImageSlot: React.FC<ImageSlotProps> = ({ url, ratio, generating, disabled, labels, onGenerate, onUpload, onDelete, onZoom, actionsFirst = false }) => {
    const actions = (
        <div className="img-actions">
            <GameButton size="sm" disabled={generating || disabled} onClick={onGenerate}>{labels.generate}</GameButton>
            <label className="gbtn gbtn-secondary gbtn-sm">
                {labels.upload}
                <input type="file" accept="image/*" onChange={onUpload} />
            </label>
        </div>
    );
    return (
        <>
            {actionsFirst && actions}
            <div className={`img-slot ${url ? 'has' : ''}`} style={{ aspectRatio: ratio }} onClick={() => url && onZoom(url)}>
                {url ? (
                    <>
                        <img src={url} alt="" />
                        <button
                            type="button"
                            className="img-del"
                            aria-label={labels.delete}
                            title={labels.delete}
                            onClick={event => {
                                event.stopPropagation();
                                onDelete();
                            }}
                        >
                            ✕
                        </button>
                    </>
                ) : labels.empty}
                {generating && <div className="img-busy" onClick={event => event.stopPropagation()}>{labels.generating}</div>}
            </div>
            {!actionsFirst && actions}
        </>
    );
};
