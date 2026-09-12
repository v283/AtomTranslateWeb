import { onRequestGet as __api_community__shortId__sections__sectionId__js_onRequestGet } from "/Users/valentine/Documents/GitHub/AtomTranslateWeb/functions/api/community/[shortId]/sections/[sectionId].js"
import { onRequestGet as __api_report_js_onRequestGet } from "/Users/valentine/Documents/GitHub/AtomTranslateWeb/functions/api/report.js"
import { onRequestPost as __api_report_js_onRequestPost } from "/Users/valentine/Documents/GitHub/AtomTranslateWeb/functions/api/report.js"
import { onRequestGet as __community__id__js_onRequestGet } from "/Users/valentine/Documents/GitHub/AtomTranslateWeb/functions/community/[id].js"
import { onRequest as ___middleware_js_onRequest } from "/Users/valentine/Documents/GitHub/AtomTranslateWeb/functions/_middleware.js"

export const routes = [
    {
      routePath: "/api/community/:shortId/sections/:sectionId",
      mountPath: "/api/community/:shortId/sections",
      method: "GET",
      middlewares: [],
      modules: [__api_community__shortId__sections__sectionId__js_onRequestGet],
    },
  {
      routePath: "/api/report",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_report_js_onRequestGet],
    },
  {
      routePath: "/api/report",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_report_js_onRequestPost],
    },
  {
      routePath: "/community/:id",
      mountPath: "/community",
      method: "GET",
      middlewares: [],
      modules: [__community__id__js_onRequestGet],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]