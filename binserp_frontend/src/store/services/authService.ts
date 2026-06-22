import { binsApi } from "./binsApi";

export const authService = binsApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<any, { type: "company" | "user"; credentials: { companyId: string; userId: string; password: string; latitude?: number; longitude?: number } }>(
      {
        query: ({ type, credentials }) => ({
          url: type === "company" ? "/api/company/login" : "/api/user/login",
          method: "POST",
          body: credentials,
        }),
        invalidatesTags: ["Auth"],
      },
    ),
  }),
  overrideExisting: false,
});

export const { useLoginMutation } = authService;


