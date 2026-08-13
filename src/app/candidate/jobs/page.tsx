"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Search, MapPin, Clock, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/dashboard-components";
import { EMPLOYMENT_TYPE_LABELS, formatDate, truncate } from "@/lib/utils";
import type { Job } from "@/types";

export default function JobsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      let query = supabase
        .from("jobs")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (debouncedSearch.trim()) {
        const term = debouncedSearch.trim();
        query = query.or(
          `title.ilike.%${term}%,company.ilike.%${term}%,description.ilike.%${term}%`
        );
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        setJobs([]);
      } else {
        setJobs(data || []);
      }
      setLoading(false);
    }

    loadJobs();
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Browse Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Explore published positions and see your role-fit score
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, company, or keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Briefcase className="h-12 w-12" />}
              title={debouncedSearch ? "No jobs found" : "No published jobs yet"}
              description={
                debouncedSearch
                  ? "Try adjusting your search terms."
                  : "Check back later for new opportunities from recruiters."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <Link key={job.id} href={`/candidate/jobs/${job.id}`}>
              <Card className="h-full hover:shadow-md hover:border-brand-200 transition-all cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{job.title}</CardTitle>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {job.company}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {EMPLOYMENT_TYPE_LABELS[job.employment_type] || job.employment_type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {truncate(job.description, 160)}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Posted {formatDate(job.created_at)}
                    </span>
                  </div>
                  {job.required_skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {job.required_skills.slice(0, 4).map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs font-normal">
                          {skill}
                        </Badge>
                      ))}
                      {job.required_skills.length > 4 && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{job.required_skills.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
