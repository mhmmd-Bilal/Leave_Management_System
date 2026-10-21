import { apiSlice, unwrap } from "../../services/apiSlice.js";
import { cleanParams } from "../../utils/errors.js";

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    getSettings: b.query({
      query: () => "/admin/settings",
      transformResponse: (r) => r.data.settings,
      providesTags: ["Settings"],
    }),
    updateSettings: b.mutation({
      query: (body) => ({ url: "/admin/settings", method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["Settings", "Calendar", "Audit"],
    }),
    getAuditLogs: b.query({
      query: (p) => ({ url: "/admin/audit-logs", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Audit"],
    }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation, useGetAuditLogsQuery } = adminApi;
