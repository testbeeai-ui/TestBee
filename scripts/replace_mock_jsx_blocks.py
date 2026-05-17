from pathlib import Path

p = Path("components/prep-mock/MockPageContent.tsx")
lines = p.read_text(encoding="utf-8").splitlines()

dashboard_component = r"""          {!isLibraryPage && view === "landing" && (
            <PrepMockDashboardView
              authUserId={authUser?.id ?? ""}
              accessToken={session?.access_token}
              nextClassName={nextClassInfo?.name ?? ""}
              nextClassTime={nextClassInfo?.time ?? ""}
              onNextClass={setNextClassInfo}
              calendarRefreshKey={calendarRefreshKey}
              onClassCalendar={() => setCalendarRefreshKey((k) => k + 1)}
              mockPending={subjects.length}
              revisionItems={revisionCards.length}
              accuracy={overallAccuracy}
              subjects={subjects}
              onStartMock={handleQuickStartMock}
              onViewAll={() => router.push("/mock-test?tab=past")}
              featuredPaper={featuredDashboardPaper ?? null}
              featuredLoading={featuredCatalogLoading}
              onStartFeaturedPaper={() => {
                const p = featuredDashboardPaper;
                if (p) {
                  router.push(`/mock-test?paper=${encodeURIComponent(p.slug)}`);
                }
              }}
              revisionCards={revisionCards}
              onCalendarActivity={() => setCalendarRefreshKey((k) => k + 1)}
            />
          )}"""

library_component = r"""          {isLibraryPage && view === "setup" && (
            <MockTestLibraryView
              onBack={() => router.push("/mock")}
              libraryCollectionTab={libraryCollectionTab}
              setLibraryCollectionTab={setLibraryCollectionTab}
              mockLibraryCategory={mockLibraryCategory}
              setMockLibraryCategory={setMockLibraryCategory}
              duration={duration}
              setDuration={setDuration}
              subjects={subjects}
              selectedSubject={selectedSubject}
              effectiveSubject={effectiveSubject}
              setSelectedSubject={setSelectedSubject}
              startQuickTest={startQuickTest}
              librarySearch={librarySearch}
              setLibrarySearch={setLibrarySearch}
              librarySubjectFilter={librarySubjectFilter}
              setLibrarySubjectFilter={setLibrarySubjectFilter}
              filteredPastCatalogPapers={filteredPastCatalogPapers}
              filteredMockCatalogPapers={filteredMockCatalogPapers}
              pastPapersByClassLevel={pastPapersByClassLevel}
              mockPapersByClassLevel={mockPapersByClassLevel}
              catalogLoading={catalogLoading}
              catalogError={catalogError}
              openNtaInstructionsForPaper={openNtaInstructionsForPaper}
            />
          )}"""

new_lines = (
    lines[:1130]
    + dashboard_component.splitlines()
    + [""]
    + library_component.splitlines()
    + lines[1587:]
)
p.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
print("done", len(lines), "->", len(new_lines))
