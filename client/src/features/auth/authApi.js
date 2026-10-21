import { apiSlice, unwrap } from "../../services/apiSlice.js";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    getMe: b.query({ query: () => "/auth/me", transformResponse: unwrap, providesTags: ["Me"] }),
    login: b.mutation({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: unwrap,
      invalidatesTags: ["Me"],
    }),
    register: b.mutation({ query: (body) => ({ url: "/auth/register", method: "POST", body }), transformResponse: unwrap }),
    logout: b.mutation({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      async onQueryStarted(_, { queryFulfilled, dispatch }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(apiSlice.util.resetApiState()); // drop every cached record of the previous user
        }
      },
    }),
    changePassword: b.mutation({ query: (body) => ({ url: "/auth/change-password", method: "PATCH", body }), transformResponse: unwrap }),
    updateProfile: b.mutation({
      query: (body) => ({ url: "/employees/me", method: "PATCH", body }),
      transformResponse: unwrap,
      invalidatesTags: ["Me"],
    }),
  }),
});

export const {
  useGetMeQuery, useLoginMutation, useRegisterMutation, useLogoutMutation, useChangePasswordMutation, useUpdateProfileMutation,
} = authApi;
