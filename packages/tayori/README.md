<h1 align="center">📬 tayori</h1>
<p align="center"><sup>(便り, <em>news from afar</em> in Japanese)</sup></p>
<p align="center">An opinionated React client-side data fetching stack built on top of SWR and Hey API</p>

The documentation can be found at [https://tayori.skk.moe](https://tayori.skk.moe).

The LLM friendly version of the documentation can be found at [https://tayori.skk.moe/llms-full.txt](https://tayori.skk.moe/llms-full.txt).

Usage example can be found in the [example-nextjs-app](./packages/example-nextjs-app).

----

```tsx
const { data, error } = useData(
  getAllPlanets,
  {
    query: { page: 1, per_page: 20 }
  }
);
```

```tsx
const { data, error } = useData(
  getAllPlanets,
  searchQuery
    ? { query: { q: searchQuery } }
    : null
);
```

```tsx
const { data } = useData(
  getPlanetById,
  () => (astronomer?.asteroidNamedAfter
    ? { id: astronomer.asteroidNamedAfter }
    : null)
);
```

```tsx
const { trigger, isMutating } = useMutation(updatePlanet);

await trigger({
  path: { planetId },
  body: { name: nextName }
});
```

```tsx
const { data, size, setSize } = useInfinite(
  getAllPlanets,
  (i, prev) => (prev?.nextCursor
    ? { query: { cursor: prev.nextCursor, perPage: 20 } }
    : null)
);
```

----

**tayori** © [Sukka](https://github.com/SukkaW), Released under the [MIT](./LICENSE) License.
Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/tayori/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka) · Twitter [@isukkaw](https://twitter.com/isukkaw) · BlueSky [@skk.moe](https://bsky.app/profile/skk.moe)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>
