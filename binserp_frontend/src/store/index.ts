import { configureStore } from "@reduxjs/toolkit";
import { binsApi } from "./services/binsApi";

export const makeStore = () =>
  configureStore({
    reducer: {
      [binsApi.reducerPath]: binsApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(binsApi.middleware),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type RootState = ReturnType<AppStore["getState"]>;


