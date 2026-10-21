import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import { Input } from "../../components/ui/Field.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import { useChangePasswordMutation, useUpdateProfileMutation } from "../../features/auth/authApi.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useToast } from "../../hooks/useToast.js";
import { formatDate } from "../../utils/format.js";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid phone number"),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

const Info = ({ label, children }) => (
  <div><dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{children}</dd></div>
);

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: changing }] = useChangePasswordMutation();
  const profile = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user.name, phone: user.phone } });
  const password = useForm({ resolver: zodResolver(passwordSchema) });
  useEffect(() => profile.reset({ name: user.name, phone: user.phone }), [user.name, user.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async (values) => {
    try {
      await updateProfile(values).unwrap();
      toast.success("Profile updated");
    } catch (e) {
      toast.fromError(e);
    }
  };
  const savePassword = async ({ currentPassword, newPassword }) => {
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      toast.success("Password changed. Other sessions were signed out.");
      password.reset();
    } catch (e) {
      toast.fromError(e);
    }
  };

  return (
    <>
      <PageHeader title="My profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <dl className="grid grid-cols-2 gap-4">
            <Info label="Name">{user.name}</Info>
            <Info label="Employee ID">{user.employeeId}</Info>
            <Info label="Email">{user.email}</Info>
            <Info label="Department">{user.department}</Info>
            <Info label="Role"><span className="capitalize">{user.role}</span></Info>
            <Info label="Status"><Badge status={user.status} /></Info>
            <Info label="Joined">{formatDate(user.joiningDate)}</Info>
          </dl>
        </Card>
        <Card title="Update details">
          <form onSubmit={profile.handleSubmit(saveProfile)} className="space-y-3" noValidate>
            <Input label="Name" error={profile.formState.errors.name?.message} {...profile.register("name")} />
            <Input label="Phone" type="tel" error={profile.formState.errors.phone?.message} {...profile.register("phone")} />
            <p className="text-xs text-slate-500">Email, department and employee ID can only be changed by an administrator.</p>
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>
        </Card>
        <Card title="Change password" className="lg:col-span-2">
          <form onSubmit={password.handleSubmit(savePassword)} className="grid gap-3 sm:grid-cols-3" noValidate>
            <Input label="Current password" type="password" autoComplete="current-password" error={password.formState.errors.currentPassword?.message} {...password.register("currentPassword")} />
            <Input label="New password" type="password" autoComplete="new-password" error={password.formState.errors.newPassword?.message} {...password.register("newPassword")} />
            <Input label="Confirm new password" type="password" autoComplete="new-password" error={password.formState.errors.confirm?.message} {...password.register("confirm")} />
            <div className="sm:col-span-3"><Button type="submit" loading={changing}>Change password</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
