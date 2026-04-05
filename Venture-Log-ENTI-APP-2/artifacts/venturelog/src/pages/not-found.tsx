/**
 * pages/not-found.tsx — 404 Not Found Page
 *
 * Displayed when a user navigates to a URL that doesn't match any
 * route defined in App.tsx. The Router component catches unmatched
 * paths and renders this component as the fallback.
 *
 * Route: (any unmatched URL)
 */

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          {/* Developer-facing hint — reminds developers to add new pages to the router */}
          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
