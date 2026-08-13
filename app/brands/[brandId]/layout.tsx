import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { requireBrandAccess, workspacesForUser } from "@/lib/auth/session";

export default async function BrandLayout({ children, params }: LayoutProps<"/brands/[brandId]">) {
  const { brandId } = await params;

  // Redirects to sign-in when signed out, and to the brand list when the user
  // is not a member — an unauthorised brand is indistinguishable from one that
  // does not exist.
  const access = await requireBrandAccess(brandId);
  const workspaces = await workspacesForUser(access.user.id);

  return (
    <div className="min-h-dvh bg-paper">
      <Sidebar
        brandId={brandId}
        brandName={access.brand.name}
        workspaceName={access.workspace.name}
        role={access.role}
        email={access.user.email}
        workspaces={workspaces}
        signOutAction={async () => {
          "use server";
          await signOut({ redirect: false });
          redirect("/");
        }}
      />
      <main className="ml-[220px] px-8 py-8">
        <div className="max-w-[1100px]">{children}</div>
      </main>
    </div>
  );
}
