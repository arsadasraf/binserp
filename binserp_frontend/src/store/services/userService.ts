import { binsApi } from "./binsApi";

export const userService = binsApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<any[], void>({
      query: () => "/api/user/all",
      transformResponse: (response: any) => response.users || [],
      providesTags: ["Auth"],
    }),
    getActiveSessions: builder.query<any[], void>({
      query: () => "/api/user/active-sessions",
      providesTags: ["Auth"],
    }),
    createUser: builder.mutation<any, Record<string, any>>({
      query: (body) => ({
        url: "/api/user/create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),
    updateUser: builder.mutation<any, { id: string; body: Record<string, any> }>({
      query: ({ id, body }) => ({
        url: `/api/user/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),
    deleteUser: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/user/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Auth"],
    }),
    toggleUserStatus: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/user/toggle-status/${id}`,
        method: "PUT",
      }),
      invalidatesTags: ["Auth"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetActiveSessionsQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useToggleUserStatusMutation,
} = userService;


