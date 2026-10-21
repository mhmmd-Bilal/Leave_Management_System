import { apiSlice, unwrap } from "../../services/apiSlice.js";
import { cleanParams } from "../../utils/errors.js";

// Everything that changes after a leave is applied / approved / rejected / cancelled.
const LEAVE_CHANGED = ["MyLeaves", "HrLeaves", "Leave", "Dashboard", "Calendar", "Reports"];

export const leavesApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    // ---- leave types
    getLeaveTypes: b.query({
      query: (p) => ({ url: "/leave-types", params: cleanParams(p) }),
      transformResponse: (r) => r.data.leaveTypes,
      providesTags: ["LeaveTypes"],
    }),
    createLeaveType: b.mutation({
      query: (body) => ({ url: "/leave-types", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: ["LeaveTypes"],
    }),
    updateLeaveType: b.mutation({
      query: ({ id, ...body }) => ({ url: `/leave-types/${id}`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["LeaveTypes"],
    }),
    setLeaveTypeStatus: b.mutation({
      query: ({ id, active }) => ({ url: `/leave-types/${id}/status`, method: "PATCH", body: { active } }),
      transformResponse: unwrap,
      invalidatesTags: ["LeaveTypes"],
    }),

    // ---- employee leave requests
    getLeaveCalculation: b.query({
      query: (p) => ({ url: "/leaves/calculate", params: cleanParams(p) }),
      transformResponse: unwrap,
      keepUnusedDataFor: 30,
    }),
    applyLeave: b.mutation({
      query: (formData) => ({ url: "/leaves", method: "POST", body: formData }), // multipart (optional document)
      transformResponse: unwrap,
      invalidatesTags: [...LEAVE_CHANGED, "Balances"],
    }),
    getMyLeaves: b.query({
      query: (p) => ({ url: "/leaves/my", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["MyLeaves"],
    }),
    getLeave: b.query({
      query: (id) => `/leaves/${id}`,
      transformResponse: (r) => r.data.leave,
      providesTags: (_r, _e, id) => [{ type: "Leave", id }],
    }),
    cancelLeave: b.mutation({
      query: (id) => ({ url: `/leaves/${id}/cancel`, method: "PATCH" }),
      transformResponse: unwrap,
      invalidatesTags: LEAVE_CHANGED,
    }),
    getDocumentLink: b.query({
      query: (id) => `/leaves/${id}/document`,
      transformResponse: unwrap,
      keepUnusedDataFor: 0, // signed links are short-lived: never reuse a cached one
    }),

    // ---- HR / Admin review
    getHrLeaves: b.query({
      query: (p) => ({ url: "/hr/leaves", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["HrLeaves"],
    }),
    approveLeave: b.mutation({
      query: (id) => ({ url: `/hr/leaves/${id}/approve`, method: "PATCH" }),
      transformResponse: unwrap,
      invalidatesTags: [...LEAVE_CHANGED, "Balances", "Notifications"],
    }),
    rejectLeave: b.mutation({
      query: ({ id, reason }) => ({ url: `/hr/leaves/${id}/reject`, method: "PATCH", body: { reason: reason || undefined } }),
      transformResponse: unwrap,
      invalidatesTags: [...LEAVE_CHANGED, "Notifications"],
    }),
  }),
});

export const {
  useGetLeaveTypesQuery, useCreateLeaveTypeMutation, useUpdateLeaveTypeMutation, useSetLeaveTypeStatusMutation,
  useGetLeaveCalculationQuery, useApplyLeaveMutation, useGetMyLeavesQuery, useGetLeaveQuery, useCancelLeaveMutation,
  useLazyGetDocumentLinkQuery, useGetHrLeavesQuery, useApproveLeaveMutation, useRejectLeaveMutation,
} = leavesApi;
