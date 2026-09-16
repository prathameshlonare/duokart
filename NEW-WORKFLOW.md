# DuoKart: Project Reset & Simplified Workflow

This document outlines the simplified, code-first approach for the remainder of the DuoKart project. We are removing the heavy documentation process to focus entirely on building AWS infrastructure and Python code via Discord pair programming.

## 1. Files and Folder Deletion (The Cleanup)
We are dropping the "enterprise compliance" overhead. Run these exact commands in your terminal to delete the unnecessary tracking files:

```bash
git rm AGENTS.md
git rm OPENCODE.md
git rm docs/contribution-log.md
git rm docs/cost-log.md
git rm docs/architecture-decisions.md
git rm docs/day-*.md
```
*Keep:* `docs/api-contracts.md` (useful for the backend later), `docs/aws-scope.md` (optional reference), and `README.md`.

## 2. Fixing the Git and GitHub Commit History
We want a clean slate going into Day 2. Commit the deletions we just made to lock in the simplified structure:

```bash
git commit -m "chore: simplify project structure and remove meta-docs"
git push origin main
```
*Note:* Your previous PRs (Day 0 and Day 1) will remain in GitHub's history, which perfectly proves your initial setup work to interviewers. Going forward, the commit history itself will serve as our actual 50/50 contribution log.

## 3. GitHub Repo Changes (Settings)
To enable fast pair programming on Discord, we need to allow direct pushes to `main`.
1. **Swapnil (Repo Owner):** Go to the DuoKart repository on GitHub.
2. Click **Settings** > **Branches**.
3. Under Branch Protection Rules, edit the rule for `main`.
4. **Uncheck** "Require a pull request before merging".
5. Save changes. 

## 4. The Pair Programming "Handoff" Rule (Crucial for Resumes)
To prove a 50/50 split in interviews, **both names must appear equally in the GitHub commit history**. You cannot have one person stream while the other watches. You must use the Handoff method:

* **Turn 1 (Swapnil):** Swapnil shares his screen, writes the first component (e.g., the Load Balancer), tests it, and runs `git commit` and `git push origin main`.
* **The Handoff:** Prathamesh runs `git pull origin main` on his machine to sync the code.
* **Turn 2 (Prathamesh):** Prathamesh shares his screen, takes over the keyboard, writes the next component (e.g., the Auto Scaling Group), tests it, and runs `git commit` and `git push origin main`.
* **Result:** True hands-on learning for both of you, and an indisputable Git history showing alternating commits. When Prathamesh forks this repo at the end, his own commits will be there to prove his contribution.

## 5. The Daily AWS Routine (Cost-Saving IaC)
Because we destroy the AWS environment every night to save our $170 budget, our CloudFormation deployment skills will become our strongest interview talking point.

**A. The Morning Rebuild (~5 mins)**
1. Log into AWS Console (us-east-2).
2. Go to CloudFormation -> Create Stack -> Upload `infra/01-vpc.yaml`.
3. Name it `duokart-02-vpc` (as done on Day 1).
4. Wait for `CREATE_COMPLETE` (The NAT Gateway takes ~3 minutes).

**B. The Build Phase**
1. Create the next CloudFormation template (e.g., `infra/02-compute.yaml`).
2. Upload, test, fix errors, and update the stack until the architecture works.

**C. The Nightly Teardown**
1. Go to CloudFormation.
2. Delete the highest number stack first (e.g., `02-compute`).
3. Delete the VPC stack last.
4. Verify EC2 instances and NAT Gateways are terminated so billing completely stops.

---

## Tomorrow: Day 2 Starting Line (Compute)
Once this cleanup is pushed, your VS Code will feel 100x lighter. You will only see `infra/01-vpc.yaml` and the Python folders. 

**Your Goal for Day 2:** 
Create `infra/02-compute.yaml`. Use the Handoff Rule: one of you builds the Application Load Balancer (ALB), then you hand off, and the other builds the EC2 instance/Auto Scaling Group.
