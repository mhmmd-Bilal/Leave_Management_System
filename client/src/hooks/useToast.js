import { useDispatch } from "react-redux";
import { pushToast } from "../features/ui/uiSlice.js";
import { getErrorMessage } from "../utils/errors.js";

export function useToast() {
  const dispatch = useDispatch();
  return {
    success: (m) => dispatch(pushToast("success", m)),
    error: (m) => dispatch(pushToast("error", m)),
    fromError: (err) => dispatch(pushToast("error", getErrorMessage(err))),
  };
}
