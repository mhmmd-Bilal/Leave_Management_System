import { apiSlice, unwrap } from "../../services/apiSlice.js";
import { cleanParams } from "../../utils/errors.js";

export const balancesApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    getMyBalances: b.query({
      query: (p) => ({ url: "/employees/me/balances", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Balances"],
    }),
    getEmployeeBalances: b.query({
      query: ({ employeeId, ...p }) => ({ url: `/hr/balances/${employeeId}`, params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Balances"],
    }),
    getAdjustments: b.query({
      query: ({ employeeId, ...p }) => ({ url: `/hr/balances/${employeeId}/adjustments`, params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Adjustments"],
    }),
    adjustBalance: b.mutation({
      query: ({ employeeId, ...body }) => ({ url: `/hr/balances/${employeeId}/adjust`, method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["Balances", "Adjustments", "Notifications", "Reports"],
    }),
    initializeBalances: b.mutation({
      query: (body) => ({ url: "/admin/balances/initialize", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: ["Balances", "Reports", "Audit"],
    }),
  }),
});

export const {
  useGetMyBalancesQuery, useGetEmployeeBalancesQuery, useGetAdjustmentsQuery, useAdjustBalanceMutation, useInitializeBalancesMutation,
} = balancesApi;
