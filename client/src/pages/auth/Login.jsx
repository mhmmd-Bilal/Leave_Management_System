import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Clock, UserX } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import Button from "../../components/ui/Button.jsx";
import { Alert } from "../../components/ui/ErrorState.jsx";
import { Input } from "../../components/ui/Field.jsx";
import { useLoginMutation } from "../../features/auth/authApi.js";
import { useAuth } from "../../hooks/useAuth.js";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { homeFor } from "../../utils/constants.js";
import { getErrorMessage } from "../../utils/errors.js";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// The backend answers 403 with a message describing the account state (after the password is verified).
function AccountNotice({ error }) {
  if (error.status !== 403) return <Alert>{getErrorMessage(error)}</Alert>;
  const msg = error.data?.message || "";
  const kind = /pending/i.test(msg) ? "pending" : /rejected/i.test(msg) ? "rejected" : /relieved/i.test(msg) ? "relieved" : "disabled";
  const copy = {
    pending: { icon: Clock, title: "Awaiting approval", text: "Your registration is pending verification by HR. You will be able to sign in once it is approved - we will notify you by email." },
    rejected: { icon: UserX, title: "Registration rejected", text: "HR did not approve this registration. Please contact HR if you believe this is a mistake." },
    disabled: { icon: Ban, title: "Account disabled", text: "Your account has been disabled. Please contact HR or an administrator." },
    relieved: { icon: Ban, title: "Account closed", text: "This account belongs to a relieved employee and can no longer be used." },
  }[kind];
  const Icon = copy.icon;
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div><p className="font-semibold">{copy.title}</p><p className="mt-1">{copy.text}</p></div>
    </div>
  );
}

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, { isLoading, error }] = useLoginMutation();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const onSubmit = async (values) => {
    try {
      const data = await login(values).unwrap();
      navigate(location.state?.from || homeFor(data.user.role), { replace: true });
    } catch {
      /* the error is displayed from the mutation state */
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Leave Management System" footer={<>New employee? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <AccountNotice error={error} />}
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <Button type="submit" loading={isLoading} className="w-full">Sign in</Button>
      </form>
    </AuthLayout>
  );
}
