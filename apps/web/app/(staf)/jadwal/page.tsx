'use client';

import { ClassList, LearningGroupList, SchedulePeriodsResponse, SubjectList, TeacherList } from '@absah/contracts';
import { Banner, DataHeader, ErrorState, PageMain, SkeletonRows, Tabs, TabsContent, TabsList, TabsTrigger, messages } from '@absah/ui';
import Link from 'next/link';
import { useState } from 'react';
import type { z } from 'zod';
import { api } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { SCHEDULE_MANAGERS, SCHEDULE_PAGE_READERS } from '@/lib/schedule-access';
import { useSection } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';
import { ScheduleGrid } from './grid';
import { GroupsTab } from './groups';
import { HomeroomTable } from './homeroom';
import { PeriodsEditor } from './periods';
import { TemplateImport } from './template-import';

const t = messages.schedule;
const d = messages.data;

export interface ScheduleData {
  classes: ClassList;
  periods: SchedulePeriodsResponse;
  subjects: z.infer<typeof SubjectList>['items'];
  teachers: z.infer<typeof TeacherList>['items'];
  /** Empty when attendance.learningGroups is off. */
  groups: z.infer<typeof LearningGroupList>['items'];
}

type Tab = 'grid' | 'groups' | 'periods' | 'homeroom' | 'import';

/**
 * Jadwal pelajaran, jam pelajaran, wali kelas and the Excel template (AKD-05; U6d). The frame and the two tabs people use most (the
 * week grid and wali kelas) are on the Data page pattern; Kelompok belajar, Jam pelajaran and Import Excel keep their forms for now.
 */
export default function JadwalPage() {
  const { schoolId, hasRole } = useWorkspace();
  const mode = useCapability('attendance.mode');
  const groupsOn = useCapability('attendance.learningGroups') === true;
  const allowed = hasRole(...SCHEDULE_PAGE_READERS);
  const canEdit = hasRole(...SCHEDULE_MANAGERS);
  const [tab, setTab] = useState<Tab | null>(null);

  const section = useSection<ScheduleData>(
    `${schoolId ?? ''}:schedule:${canEdit}:${groupsOn}`,
    schoolId && allowed
      ? async () => {
          const [classes, periods, subjects, teachers, groups] = await Promise.all([
            api('/classes', ClassList, { schoolId }),
            api('/schedule/periods', SchedulePeriodsResponse, { schoolId }),
            api('/subjects', SubjectList, { schoolId }),
            canEdit ? api('/schedule/teachers', TeacherList, { schoolId }) : Promise.resolve({ items: [] }),
            groupsOn ? api('/learning-groups', LearningGroupList, { schoolId }) : Promise.resolve({ items: [] }),
          ]);
          return { classes, periods, subjects: subjects.items, teachers: teachers.items, groups: groups.items };
        }
      : null,
  );
  const data = section.data;
  const load = () => {
    section.reload();
    return Promise.resolve();
  };

  if (!allowed) {
    return (
      <PageMain width="full">
        <h1 className="m-0 text-h1">{t.title}</h1>
        <p role="alert" className="m-0 text-body">
          {d.forbidden}
        </p>
      </PageMain>
    );
  }

  const daily = mode === 'daily';
  const current: Tab = tab ?? (daily ? 'homeroom' : 'grid');
  const tabs: [Tab, string][] = [
    ['grid', t.tabGrid],
    ...(groupsOn ? ([['groups', t.tabGroups]] as [Tab, string][]) : []),
    ['periods', t.tabPeriods],
    ['homeroom', t.tabHomeroom],
    ...(canEdit ? ([['import', t.tabImport]] as [Tab, string][]) : []),
  ];
  const year = data?.classes.academicYear?.name;

  return (
    <PageMain width="full">
      <DataHeader title={year ? `${t.title} ${year}` : t.title} />
      {daily && <Banner kind="info">{t.dailyNote}</Banner>}
      {section.state === 'offline' && <Banner kind="offline">{d.offlineBody}</Banner>}
      {section.state === 'error' && (
        <ErrorState title={t.loadFailed} onRetry={section.reload}>
          {d.loadFailedBody}
        </ErrorState>
      )}
      {section.state === 'loading' && <SkeletonRows count={6} />}
      {data && !data.classes.academicYear && (
        <Banner kind="info">
          {t.noYear} <Link href="/import">{t.noYearLink}</Link>
          {t.noYearAfter}
        </Banner>
      )}
      {data?.classes.academicYear && (
        <Tabs value={current} onValueChange={(v) => setTab(v as Tab)} className="flex flex-col gap-4">
          <TabsList label={t.tabsLabel}>
            {tabs.map(([id, label]) => (
              <TabsTrigger key={id} value={id}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="grid">
            <ScheduleGrid data={data} canEdit={canEdit} onChanged={load} />
          </TabsContent>
          {groupsOn && (
            <TabsContent value="groups">
              <GroupsTab data={data} canEdit={canEdit} onChanged={load} />
            </TabsContent>
          )}
          <TabsContent value="periods">
            <PeriodsEditor initial={data.periods} canEdit={canEdit} onSaved={load} />
          </TabsContent>
          <TabsContent value="homeroom">
            <HomeroomTable data={data} canEdit={canEdit} onSaved={load} />
          </TabsContent>
          {canEdit && (
            <TabsContent value="import">
              <TemplateImport onApplied={load} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </PageMain>
  );
}
