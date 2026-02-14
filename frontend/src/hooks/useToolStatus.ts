import { useState, type ReactNode } from "react";

type ToolStatusValue = ReactNode | "";

type InitialToolStatus = {
  error?: ToolStatusValue;
  success?: ToolStatusValue;
  info?: ToolStatusValue;
};

export default function useToolStatus(initial: InitialToolStatus = {}) {
  const [error, setErrorState] = useState<ToolStatusValue>(initial.error ?? "");
  const [success, setSuccessState] = useState<ToolStatusValue>(initial.success ?? "");
  const [info, setInfoState] = useState<ToolStatusValue>(initial.info ?? "");

  const setError = (value?: ReactNode) => setErrorState(value ?? "");
  const setSuccess = (value?: ReactNode) => setSuccessState(value ?? "");
  const setInfo = (value?: ReactNode) => setInfoState(value ?? "");

  const clear = () => {
    setErrorState("");
    setSuccessState("");
    setInfoState("");
  };

  return {
    error,
    success,
    info,
    setError,
    setSuccess,
    setInfo,
    clear,
  };
}
