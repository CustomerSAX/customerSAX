export interface CSASelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CSASelectProps {
  options: CSASelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
  onChange?: (value: string) => void;
}
