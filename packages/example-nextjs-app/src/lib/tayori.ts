import { tayori } from 'tayori';
import { getAllData, createPlanet } from '@/sdk';
import type { Options } from '@/sdk';
import type { RequestResult } from '@/sdk/client';

export const {
  useData,
  useMutation,
  TayoriProvider
} = tayori<Options, RequestResult>();

// Typically we want to export a custom hook that wraps useData and useMutation with our SDK methods
// instead of using those two hooks directly in your application.
//
// In this example those custom hooks are placed under the same file for simplicity, but you can choose
// whereever you want to put them and how you want to name them.

export function useGetAllPlanets() {
  return useData(
    getAllData,
    // all request options here are fully typed and have autocompletion!
    { query: {} }
  );
};

// You can check out the usage of useMutation in the planet-form.tsx component
export function useCreatePlanet() {
  return useMutation(createPlanet);
};
