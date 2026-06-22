import { binsApi } from "./binsApi";

export const hrService = binsApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmployees: builder.query<any[], void>({
      query: () => "/api/hr/employee",
      transformResponse: (response: any) => response.employees || [],
      providesTags: ["Employees"],
    }),
    getAttendance: builder.query<any[], void>({
      query: () => "/api/hr/attendance",
      transformResponse: (response: any) => response.attendance || [],
      providesTags: ["Attendance"],
    }),
    createEmployee: builder.mutation<any, FormData>({
      query: (body) => ({
        url: "/api/hr/employee",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Employees"],
    }),
    recordAttendance: builder.mutation<any, FormData>({
      query: (body) => ({
        url: "/api/hr/attendance",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Attendance"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmployeesQuery,
  useGetAttendanceQuery,
  useCreateEmployeeMutation,
  useRecordAttendanceMutation,
} = hrService;


