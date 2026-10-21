import { apiSlice, unwrap } from "../../services/apiSlice.js";
import { cleanParams } from "../../utils/errors.js";

const list = (url, tag) => ({
  query: (p) => ({ url, params: cleanParams(p) }),
  transformResponse: unwrap,
  providesTags: [tag],
});

export const employeesApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    // ---- HR: employees + registration review
    getHrEmployees: b.query(list("/hr/employees", "Employees")),
    getPendingRegistrations: b.query(list("/hr/registrations/pending", "Registrations")),
    getRejectedRegistrations: b.query(list("/hr/registrations/rejected", "Registrations")),
    approveRegistration: b.mutation({
      query: (id) => ({ url: `/hr/employees/${id}/approve`, method: "PATCH" }),
      transformResponse: unwrap,
      invalidatesTags: ["Registrations", "Employees", "AdminAccounts", "Dashboard", "Audit"],
    }),
    rejectRegistration: b.mutation({
      query: ({ id, reason }) => ({ url: `/hr/employees/${id}/reject`, method: "PATCH", body: { reason: reason || undefined } }),
      transformResponse: unwrap,
      invalidatesTags: ["Registrations", "Employees", "AdminAccounts", "Dashboard", "Audit"],
    }),

    // ---- Admin: employees
    getAdminEmployees: b.query(list("/admin/employees", "AdminAccounts")),
    updateAdminEmployee: b.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/employees/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["AdminAccounts", "Employees", "Audit"],
    }),
    setAdminEmployeeStatus: b.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/employees/${id}/status`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["AdminAccounts", "Employees", "Dashboard", "Audit"],
    }),

    // ---- Admin: HR accounts
    getAdminHr: b.query(list("/admin/hr", "HrAccounts")),
    createHr: b.mutation({
      query: (body) => ({ url: "/admin/hr", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: ["HrAccounts", "Audit"],
    }),
    updateAdminHr: b.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/hr/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["HrAccounts", "Audit"],
    }),
    setAdminHrStatus: b.mutation({
      query: ({ id, ...body }) => ({ url: `/admin/hr/${id}/status`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["HrAccounts", "Audit"],
    }),
  }),
});

export const {
  useGetHrEmployeesQuery, useGetPendingRegistrationsQuery, useGetRejectedRegistrationsQuery,
  useApproveRegistrationMutation, useRejectRegistrationMutation,
  useGetAdminEmployeesQuery, useUpdateAdminEmployeeMutation, useSetAdminEmployeeStatusMutation,
  useGetAdminHrQuery, useCreateHrMutation, useUpdateAdminHrMutation, useSetAdminHrStatusMutation,
} = employeesApi;
