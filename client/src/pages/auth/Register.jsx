import { zodResolver } from "@hookform/resolvers/zod";
import { Clock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import Button from "../../components/ui/Button.jsx";
import { Alert } from "../../components/ui/ErrorState.jsx";
import { Input } from "../../components/ui/Field.jsx";
import { useRegisterMutation } from "../../features/auth/authApi.js";
import AuthLayout from "../../layouts/AuthLayout.jsx";
import { getErrorMessage } from "../../utils/errors.js";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid phone number"),
  employeeId: z.string().trim().min(2, "Employee ID is required").regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  department: z.string().trim().min(2, "Department is required"),
  joiningDate: z.string().min(1, "Joining date is required"),
  password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export default function Register() {
  const [registerUser, { isLoading, error }] = useRegisterMutation();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ confirmPassword: _ignored, ...values }) => {
    try {
      await registerUser(values).unwrap();
      setDone(true);
    } catch {
      /* shown below */
    }
  };

  if (done) {
    return (
      <AuthLayout title="Registration received">
        <div className="flex flex-col items-center gap-3 text-center">
          <Clock className="h-10 w-10 text-amber-500" aria-hidden="true" />
          <p className="text-sm text-slate-700">Your account is <strong>pending approval</strong>. HR will verify your details; once approved you can sign in and apply for leave.</p>
          <Link to="/login" className="text-sm font-medium text-brand-600 hover:underline">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Registrations are verified by HR before you can sign in" footer={<>Already registered? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        {error && <Alert>{getErrorMessage(error)}</Alert>}
        <Input label="Full name" required autoComplete="name" error={errors.name?.message} {...register("name")} />
        <Input label="Email" type="email" required autoComplete="email" error={errors.email?.message} {...register("email")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Phone" type="tel" required error={errors.phone?.message} {...register("phone")} />
          <Input label="Employee ID" required error={errors.employeeId?.message} {...register("employeeId")} />
          <Input label="Department" required error={errors.department?.message} {...register("department")} />
          <Input label="Joining date" type="date" required error={errors.joiningDate?.message} {...register("joiningDate")} />
        </div>
        <Input label="Password" type="password" required autoComplete="new-password" hint="Min 8 characters, with a letter and a number" error={errors.password?.message} {...register("password")} />
        <Input label="Confirm password" type="password" required autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        <Button type="submit" loading={isLoading} className="w-full">Register</Button>
      </form>
    </AuthLayout>
  );
}
