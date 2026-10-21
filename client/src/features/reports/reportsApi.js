import { apiSlice, unwrap } from "../../services/apiSlice.js";
import { cleanParams } from "../../utils/errors.js";

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (b) => ({
    getHrDashboard: b.query({
      query: (p) => ({ url: "/hr/dashboard", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Dashboard"],
    }),
    getCalendar: b.query({
      query: (p) => ({ url: "/calendar/leaves", params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Calendar"],
    }),
    getReport: b.query({
      query: ({ name, ...p }) => ({ url: `/reports/${name}`, params: cleanParams(p) }),
      transformResponse: unwrap,
      providesTags: ["Reports"],
    }),
    // The backend returns real CSV text; the page turns it into a file download.
    exportCsv: b.query({
      query: (p) => ({ url: "/reports/export/csv", params: cleanParams(p), responseHandler: "text" }),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const { useGetHrDashboardQuery, useGetCalendarQuery, useGetReportQuery, useLazyExportCsvQuery } = reportsApi;
