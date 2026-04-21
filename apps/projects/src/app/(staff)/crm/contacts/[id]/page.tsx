import { prisma } from "@/lib/prisma";
import { requireAppUser } from "@/lib/auth";
import Link from "next/link";
import BookmarkButton from "@/components/BookmarkButton";
import { isBookmarked } from "@/lib/bookmarks/actions";
import { notFound } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { ConfirmForm } from "@/components/ConfirmForm";
import { deleteContact, unlinkContactFromCompany, addContactNote, linkContactToCompany } from "../actions";

const STRENGTH_LABELS: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};
const STRENGTH_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-700",
  SILVER: "bg-gray-100 text-gray-600",
  GOLD: "bg-yellow-100 text-yellow-700",
};

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAppUser();
  const { id } = await params;
  const bookmarked = await isBookmarked(id);
  const sp = await searchParams;
  const activeTab = sp.tab ?? "overview";

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      companyContacts: {
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ isPrimary: "desc" }, { company: { name: "asc" } }],
      },
      contactOwner: { select: { id: true, firstName: true, lastName: true } },
      notes: {
        include: { createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      },
      communications: {
        orderBy: { sentAt: "desc" },
        take: 50,
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!contact) notFound();

  const primaryCompany = contact.companyContacts.find((cc) => cc.isPrimary);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "companies", label: `Companies (${contact.companyContacts.length})` },
    { id: "communications", label: `Comms (${contact.communications.length})` },
    { id: "notes", label: `Notes (${contact.notes.length})` },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <Link href="/crm/contacts" className="text-xs text-zinc-500 hover:text-zinc-800 mb-3 inline-flex items-center gap-1">
        ← Contacts
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900">
                {contact.firstName} {contact.lastName}
              </h1>
              <BookmarkButton entityType="contact" entityId={id} entityLabel={`${contact.firstName} ${contact.lastName}`} entityUrl={`/crm/contacts/${id}`} initialBookmarked={bookmarked} />
              {!contact.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
              )}
              {contact.doNotCall && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                  Do Not Call
                </span>
              )}
            </div>
            {contact.jobTitle && (
              <p className="text-sm text-zinc-500 mt-0.5">{contact.jobTitle}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {primaryCompany && (
                <Link
                  href={`/crm/companies/${primaryCompany.company.id}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                >
                  {primaryCompany.company.name}
                </Link>
              )}
              {contact.contactType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                  {contact.contactType}
                </span>
              )}
              {contact.contactSubType && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                  {contact.contactSubType}
                </span>
              )}
              {contact.contactOwnerStrength && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STRENGTH_COLORS[contact.contactOwnerStrength]}`}>
                  {STRENGTH_LABELS[contact.contactOwnerStrength]}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/crm/contacts/${id}/edit`}
              className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
            <ConfirmForm
              action={deleteContact.bind(null, id)}
              message={`Delete ${contact.firstName} ${contact.lastName}? This cannot be undone.`}
            >
              <button
                type="submit"
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </ConfirmForm>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabNav tabs={TABS} baseHref={`/crm/contacts/${id}`} />

      {activeTab === "overview" && <OverviewTab contact={contact} />}
      {activeTab === "companies" && (
        <CompaniesTab
          companyContacts={contact.companyContacts}
          contactId={id}
        />
      )}
      {activeTab === "communications" && (
        <CommunicationsTab communications={contact.communications} />
      )}
      {activeTab === "notes" && (
        <NotesTab notes={contact.notes} contactId={id} />
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

type ContactFull = Awaited<ReturnType<typeof prisma.contact.findUniqueOrThrow>>;

function Row({
  label,
  value,
  isLink,
}: {
  label: string;
  value: string | null | undefined;
  isLink?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500 w-48 shrink-0">{label}</dt>
      <dd className="text-zinc-800">
        {value ? (
          isLink ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </dd>
    </div>
  );
}

function OverviewTab({
  contact,
}: {
  contact: ContactFull & {
    contactOwner: { firstName: string; lastName: string } | null;
    createdBy: { firstName: string; lastName: string };
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {/* Contact Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Contact</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Email" value={contact.email} />
          <Row label="Mobile" value={contact.mobile} />
          <Row label="Phone (DDI)" value={contact.phoneDdi} />
          <Row label="Preferred Method" value={contact.preferredContactMethod} />
          <Row label="Do Not Call" value={contact.doNotCall ? "Yes" : "No"} />
          <Row label="Mailing Address" value={contact.mailingAddress} />
        </dl>
      </div>

      {/* Social */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Social</h3>
        <dl className="space-y-2 text-sm">
          <Row label="LinkedIn" value={contact.linkedinUrl} isLink />
          <Row label="Instagram" value={contact.instagramUrl} isLink />
        </dl>
      </div>

      {/* Classification */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Classification</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Type" value={contact.contactType} />
          <Row label="Sub-Type" value={contact.contactSubType} />
          <Row label="Location" value={contact.contactLocation} />
        </dl>
      </div>

      {/* Ownership */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Ownership</h3>
        <dl className="space-y-2 text-sm">
          <Row
            label="Contact Owner"
            value={
              contact.contactOwner
                ? `${contact.contactOwner.firstName} ${contact.contactOwner.lastName}`
                : null
            }
          />
          <Row
            label="Relationship Strength"
            value={contact.contactOwnerStrength
              ? { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold" }[contact.contactOwnerStrength] ?? contact.contactOwnerStrength
              : null
            }
          />
          <Row label="Legal Basis for Data" value={contact.legalBasisForData} />
        </dl>
      </div>

      {/* Record */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Record</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Data Source" value={contact.dataSource} />
          <Row
            label="Created By"
            value={`${contact.createdBy.firstName} ${contact.createdBy.lastName}`}
          />
          <Row label="Created" value={formatDate(contact.createdAt)} />
          <Row label="Last Updated" value={formatDate(contact.updatedAt)} />
        </dl>
      </div>
    </div>
  );
}

// ─── Companies Tab ────────────────────────────────────────────────────────────

type CompanyContact = {
  id: string;
  companyId: string;
  isPrimary: boolean;
  isAccountContact: boolean;
  isEstimatingContact: boolean;
  position: string | null;
  company: { id: string; name: string };
};

function CompaniesTab({
  companyContacts,
  contactId,
}: {
  companyContacts: CompanyContact[];
  contactId: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">
          {companyContacts.length} compan{companyContacts.length !== 1 ? "ies" : "y"}
        </p>
        <Link
          href={`/crm/contacts/new?returnTo=/crm/contacts/${contactId}?tab=companies`}
          className="text-sm text-blue-600 hover:underline"
        >
          + Link Another Company
        </Link>
      </div>
      {companyContacts.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-sm">No companies linked.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Position</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs">Flags</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {companyContacts.map((cc, idx) => (
                <tr key={cc.id} className={idx < companyContacts.length - 1 ? "border-b border-gray-100" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`/crm/companies/${cc.company.id}`} className="text-blue-600 hover:underline font-medium">
                      {cc.company.name}
                    </Link>
                    {cc.isPrimary && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Primary</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{cc.position || "—"}</td>
                  <td className="px-4 py-2.5 text-center text-xs text-zinc-400">
                    {cc.isAccountContact && <span className="mr-1">Acct</span>}
                    {cc.isEstimatingContact && <span>Est</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ConfirmForm
                      action={unlinkContactFromCompany.bind(null, contactId, cc.companyId)}
                      message={`Unlink from ${cc.company.name}?`}
                    >
                      <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                        Unlink
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Communications Tab ───────────────────────────────────────────────────────

type Communication = {
  id: string;
  direction: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
  sentAt: Date;
};

function CommunicationsTab({ communications }: { communications: Communication[] }) {
  if (communications.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p className="text-sm">No communications recorded.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {communications.map((c) => (
        <div key={c.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                  c.direction === "OUTBOUND" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                }`}
              >
                {c.direction === "OUTBOUND" ? "Sent" : "Received"}
              </span>
              <p className="text-sm font-medium text-zinc-800 truncate">{c.subject}</p>
            </div>
            <span className="text-xs text-zinc-400 shrink-0">{formatDate(c.sentAt)}</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {c.direction === "OUTBOUND" ? `To: ${c.toEmail}` : `From: ${c.fromEmail}`}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

type ContactNote = {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: { firstName: string; lastName: string };
};

function NotesTab({ notes, contactId }: { notes: ContactNote[]; contactId: string }) {
  return (
    <div className="space-y-4">
      {/* Add note form */}
      <form action={addContactNote.bind(null, contactId)} className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-xs font-medium text-zinc-600 mb-2">Add Note</label>
        <textarea
          name="content"
          rows={3}
          placeholder="Write a note…"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Note
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="text-center py-8 text-zinc-400">
          <p className="text-sm">No notes yet.</p>
        </div>
      ) : (
        notes.map((note) => (
          <div key={note.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-sm text-zinc-800 whitespace-pre-wrap">{note.content}</p>
            <p className="text-xs text-zinc-400 mt-2">
              {note.createdBy.firstName} {note.createdBy.lastName} &middot; {formatDate(note.createdAt)}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
