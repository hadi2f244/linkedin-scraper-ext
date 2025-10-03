# ChatGPT Prompt Examples

Collection of useful prompts for analyzing LinkedIn job postings.

---

## Table of Contents

1. [Default Prompt](#default-prompt)
2. [Detailed Analysis](#detailed-analysis)
3. [Quick Summary](#quick-summary)
4. [Skill-Focused](#skill-focused)
5. [Salary-Focused](#salary-focused)
6. [Remote Work Focus](#remote-work-focus)
7. [Career Level Assessment](#career-level-assessment)
8. [Red Flags Detector](#red-flags-detector)
9. [Custom Prompts](#custom-prompts)

---

## Default Prompt

**Use case:** Balanced, structured summary

```text
I will send you a job description text.
Your task is to make a short summary in a strictly structured form (numbered list):

1. Skills — key technologies, programming languages, experience, soft skills (only from the text).
2. Salary — specify if mentioned. If not, estimate the range based on the market/country.
3. Education — only if explicitly required.
4. Language — level/requirement, if mentioned.
5. Work format and location — office/hybrid/remote, country/city, citizenship requirements (if mentioned).

Important:
• Write as briefly as possible, one line per item.
• No extra words or comments.
• If there is no information in the job description — skip the item (do not write "no data").

Answer in English.

Job description:
```

**Example Output:**
```
1. Skills: 5+ years DevOps, Kubernetes, Docker, CI/CD, Python, AWS, Terraform
2. Salary: £80,000-£120,000 (estimated UK market rate)
3. Education: Bachelor's in Computer Science or equivalent experience
4. Work format and location: Hybrid (2 days/week office), London, UK. Visa sponsorship available.
```

---

## Detailed Analysis

**Use case:** Comprehensive breakdown for important applications

```text
Analyze this job description in detail:

1. **Role Summary** (2-3 sentences)
2. **Required Skills:**
   - Technical skills (with years of experience)
   - Soft skills
   - Tools & technologies
3. **Preferred/Nice-to-have Skills**
4. **Responsibilities:** Top 5 key responsibilities
5. **Compensation:**
   - Salary (if mentioned, or estimate)
   - Benefits mentioned
6. **Work Arrangement:**
   - Location
   - Remote/Hybrid/Office
   - Travel requirements
7. **Company Culture Indicators:** What the job description reveals about company culture
8. **Career Growth:** Opportunities mentioned
9. **Red Flags:** Any concerning aspects (or "None apparent")
10. **Match Assessment:** Rate 1-10 how well this matches a senior DevOps engineer profile

Job description:
```

---

## Quick Summary

**Use case:** Fast scanning of multiple jobs

```text
Summarize this job in 3 bullet points:
• Key skills required (top 5)
• Salary range (estimate if not mentioned)
• Location & work format

Be extremely concise. No extra words.

Job description:
```

**Example Output:**
```
• Kubernetes, Python, AWS, CI/CD, Terraform
• £70k-£100k (estimated)
• London, Hybrid (2 days office)
```

---

## Skill-Focused

**Use case:** Checking if you meet requirements

```text
Extract all skills and requirements from this job description.

Categorize as:

**MUST HAVE:**
- [List all required/mandatory skills]

**NICE TO HAVE:**
- [List all preferred/optional skills]

**EXPERIENCE LEVEL:**
- [Years of experience required]

**CERTIFICATIONS:**
- [Any certifications mentioned]

Be specific. Include version numbers if mentioned (e.g., "Python 3.x", "AWS Certified").

Job description:
```

---

## Salary-Focused

**Use case:** Evaluating compensation

```text
Analyze the compensation for this role:

1. **Stated Salary:** [If mentioned, otherwise "Not specified"]
2. **Estimated Range:** [Based on role, location, experience level]
3. **Benefits Mentioned:**
   - Health insurance
   - Pension/401k
   - Stock options
   - Bonus structure
   - Other perks
4. **Total Compensation Estimate:** [Salary + benefits value]
5. **Market Comparison:** [Is this competitive for the role/location?]

Job description:
```

---

## Remote Work Focus

**Use case:** Finding remote opportunities

```text
Analyze the work arrangement for this job:

1. **Work Location:**
   - Fully remote / Hybrid / Office-based
   - If hybrid: how many days in office?
   - Office location(s)

2. **Remote Policy:**
   - Can work from anywhere?
   - Specific country/timezone required?
   - Occasional office visits required?

3. **Flexibility Indicators:**
   - Flexible hours mentioned?
   - Async work culture?
   - Global team?

4. **Remote Work Red Flags:**
   - "Must be in office for onboarding"
   - "Team collaboration requires presence"
   - Other concerns

5. **Verdict:** [Truly remote / Hybrid / Office-required]

Job description:
```

---

## Career Level Assessment

**Use case:** Understanding seniority expectations

```text
Assess the career level for this position:

1. **Official Title:** [From job description]
2. **Actual Level:** [Junior / Mid / Senior / Lead / Principal]
3. **Years of Experience:** [Required range]
4. **Leadership Expectations:**
   - Managing people? (Yes/No, how many)
   - Technical leadership?
   - Strategic responsibilities?
5. **Scope of Impact:**
   - Individual contributor
   - Team-level
   - Department-level
   - Company-wide
6. **Growth Potential:** [What's the next step from this role?]
7. **Red Flags:** [Title inflation, unclear expectations, etc.]

Job description:
```

---

## Red Flags Detector

**Use case:** Identifying problematic job postings

```text
Analyze this job description for potential red flags:

**RED FLAGS FOUND:**
- [List any concerning aspects]

**YELLOW FLAGS (Minor concerns):**
- [List questionable aspects]

**GREEN FLAGS (Positive signs):**
- [List good aspects]

**Common red flags to check:**
- Unrealistic skill requirements
- "Rockstar/Ninja/Guru" language
- Unpaid work expectations
- Vague job description
- Excessive responsibilities for level
- No salary range
- "Wear many hats" for senior role
- "Fast-paced startup" (code for chaos)
- Required unpaid "trial project"
- "Family culture" (boundary issues)

**Overall Assessment:** [Apply / Proceed with caution / Avoid]

Job description:
```

---

## Custom Prompts

### For Specific Industries

**Fintech Focus:**
```text
Analyze this fintech job:
1. Financial domain knowledge required
2. Regulatory/compliance requirements
3. Security & data protection emphasis
4. Fintech-specific technologies
5. Salary competitiveness for fintech

Job description:
```

**Startup Focus:**
```text
Analyze this startup role:
1. Stage of startup (seed/series A/B/C)
2. Equity/stock options mentioned
3. Responsibilities breadth
4. Growth opportunity indicators
5. Stability concerns
6. Recommendation: [Good startup bet / Risky / Avoid]

Job description:
```

### For Specific Roles

**DevOps Engineer:**
```text
DevOps-specific analysis:
1. Infrastructure: Cloud platforms, IaC tools
2. CI/CD: Tools and practices
3. Containers & Orchestration: Docker, Kubernetes, etc.
4. Monitoring & Logging: Tools mentioned
5. On-call expectations
6. Team size and structure
7. Automation level expected

Job description:
```

**Frontend Developer:**
```text
Frontend-specific analysis:
1. Frameworks: React, Vue, Angular, etc.
2. State management: Redux, MobX, etc.
3. Build tools: Webpack, Vite, etc.
4. Testing: Jest, Cypress, etc.
5. Design collaboration: Figma, etc.
6. Performance focus
7. Accessibility requirements

Job description:
```

---

## Tips for Writing Custom Prompts

### 1. Be Specific
❌ "Tell me about this job"
✅ "List the required technical skills with years of experience"

### 2. Use Structure
❌ "What are the requirements?"
✅ "List requirements in categories: Technical, Experience, Education, Soft Skills"

### 3. Set Constraints
❌ "Summarize this job"
✅ "Summarize in exactly 3 bullet points, max 10 words each"

### 4. Request Format
❌ "What's the salary?"
✅ "Salary: [Exact if stated, or estimated range with reasoning]"

### 5. Handle Missing Info
❌ (Prompt doesn't mention what to do if info missing)
✅ "If salary not mentioned, estimate based on role/location. If impossible to estimate, write 'Insufficient data'"

### 6. Ask for Reasoning
❌ "Is this a senior role?"
✅ "Is this a senior role? Explain based on: years required, responsibilities, scope of impact"

---

## Prompt Variables

You can create templates with placeholders:

```text
Analyze this {ROLE_TYPE} position:
1. Required skills for {ROLE_TYPE}
2. Experience level (Junior/Mid/Senior)
3. {FOCUS_AREA} technologies mentioned
4. Salary estimate for {ROLE_TYPE} in {LOCATION}
5. Remote work policy

Job description:
```

Replace before using:
- `{ROLE_TYPE}`: DevOps Engineer, Frontend Developer, etc.
- `{FOCUS_AREA}`: Cloud, Frontend, Backend, etc.
- `{LOCATION}`: UK, US, Europe, etc.

---

## Testing Your Prompts

1. **Try on 3-5 different jobs**
2. **Check consistency** of output format
3. **Verify accuracy** of extracted information
4. **Adjust** based on results
5. **Save** successful prompts

---

## Combining with Keywords

**Strategy:** Use keywords to filter, prompt to analyze

**Example workflow:**
1. Keywords filter: `kubernetes, python, aws`
2. If all ✅, send to ChatGPT with detailed prompt
3. If some ❌, use quick summary prompt
4. If all ❌, skip ChatGPT entirely

---

**Need more examples?** Check the [ChatGPT Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)

