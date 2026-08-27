import { useRouter } from 'expo-router';

type RouterInstance = ReturnType<typeof useRouter>;

/**
 * Defensively navigates back if there is a screen in the history stack,
 * otherwise navigates to the specified fallback route using replace.
 */
export function safeBack(router: RouterInstance, fallback: string) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
