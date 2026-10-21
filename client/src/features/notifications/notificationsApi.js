import { apiSlice, unwrap } from "../../services/apiSlice.js";
import { cleanParams } from "../../utils/errors.js";

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    getNotifications: b.query({
      query: (p) => ({ url: "/notifications", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Notifications"],
    }),
    getUnreadCount: b.query({
      query: () => "/notifications/unread-count",
      transformResponse: (r) => r.data.unread,
      providesTags: ["Notifications"],
    }),
    markNotificationRead: b.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),
    markAllNotificationsRead: b.mutation({
      query: () => ({ url: "/notifications/read-all", method: "PATCH" }),
      invalidatesTags: ["Notifications"],
    }),
  }),
});

export const {
  useGetNotificationsQuery, useGetUnreadCountQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation,
} = notificationsApi;
