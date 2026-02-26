/* ==========================================================================
   freelanxur -- Main JavaScript
   IIFE: API fetching, DOM rendering, scroll animations, interactive features
   ========================================================================== */

(function () {
    'use strict';

    /* ----------------------------------------------------------------------
       1. THEME
       ---------------------------------------------------------------------- */

    const THEME_KEY = 'theme';
    const DARK = 'dark';
    const LIGHT = 'light';

    function getTheme() {
        return localStorage.getItem(THEME_KEY) || DARK;
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);

        // Update Psyduck image filter (handled by CSS variable --psyduck-filter)
        // Update GitHub icon if it has been rendered
        const ghIcon = document.getElementById('github-icon');
        if (ghIcon) {
            ghIcon.src = theme === DARK
                ? '/static/images/github-logo-dark.png'
                : '/static/images/github-logo-light.png';
        }
    }

    function setupThemeToggle() {
        applyTheme(getTheme());

        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        btn.addEventListener('click', function () {
            const next = getTheme() === DARK ? LIGHT : DARK;
            applyTheme(next);
        });
    }

    /* ----------------------------------------------------------------------
       2. NAVBAR -- Hamburger, Mobile Menu, Active Highlighting
       ---------------------------------------------------------------------- */

    function setupNavbar() {
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');

        if (hamburger && mobileMenu) {
            hamburger.addEventListener('click', function () {
                hamburger.classList.toggle('active');
                mobileMenu.classList.toggle('active');
                hamburger.setAttribute(
                    'aria-expanded',
                    hamburger.classList.contains('active').toString()
                );
            });

            // Close mobile menu when a link is clicked
            mobileMenu.querySelectorAll('.mobile-link').forEach(function (link) {
                link.addEventListener('click', function () {
                    hamburger.classList.remove('active');
                    mobileMenu.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                });
            });
        }

        // Scroll indicator click
        var scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.addEventListener('click', function () {
                var metricsSection = document.getElementById('metrics');
                if (metricsSection) {
                    metricsSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Navbar background on scroll (add scrolled class)
        var navbar = document.getElementById('navbar');
        if (navbar) {
            window.addEventListener('scroll', function () {
                if (window.scrollY > 100) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }, { passive: true });
        }
    }

    function setupNavHighlighting() {
        var sections = document.querySelectorAll('.section[id]');
        var navLinks = document.querySelectorAll('.nav-link');

        if (!sections.length || !navLinks.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var id = entry.target.id;
                    navLinks.forEach(function (link) {
                        var href = link.getAttribute('href');
                        if (href === '#' + id) {
                            link.classList.add('active');
                        } else {
                            link.classList.remove('active');
                        }
                    });
                }
            });
        }, {
            rootMargin: '-20% 0px -60% 0px',
            threshold: 0
        });

        sections.forEach(function (section) {
            observer.observe(section);
        });
    }

    /* ----------------------------------------------------------------------
       3. API FETCH HELPER
       ---------------------------------------------------------------------- */

    async function fetchJSON(url) {
        var res = await fetch(url);
        return res.json();
    }

    /* ----------------------------------------------------------------------
       4. SVG ICON MAP
       ---------------------------------------------------------------------- */

    var SVG_ICONS = {
        database: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>',
        transfer: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 16l-4-4 4-4"/><path d="M3 12h18"/><path d="M17 8l4 4-4 4"/></svg>',
        gear: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        lightbulb: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>'
    };

    function getServiceIcon(iconName) {
        return SVG_ICONS[iconName] || SVG_ICONS.gear;
    }

    /* ----------------------------------------------------------------------
       5. TAG HUE MAP & HELPERS
       ---------------------------------------------------------------------- */

    var TAG_HUES = {
        'Python': 210, 'SQL': 200, 'Excel': 140, 'AI': 280,
        'Git': 30, 'Docker': 200, 'AWS': 30, 'GitHub': 270,
        'FastAPI': 170, 'Streamlit': 0, 'HTML/CSS': 15,
        'Splink': 260, 'SQL/BigQuery': 200, 'Fivetran': 180,
        'Hex.Tech': 320
    };

    function hashHue(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) % 360;
    }

    function tagHue(tag) {
        return TAG_HUES[tag] !== undefined ? TAG_HUES[tag] : hashHue(tag);
    }

    /* ----------------------------------------------------------------------
       6. DURATION CALCULATION
       ---------------------------------------------------------------------- */

    function calculateDuration(startStr, endStr) {
        var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

        function parse(s) {
            if (s.toLowerCase() === 'present') return new Date();
            var parts = s.trim().split(/\s+/);
            var monthIdx = months.findIndex(function (m) {
                return parts[0].toLowerCase().startsWith(m);
            });
            return new Date(parseInt(parts[1], 10), monthIdx);
        }

        var start = parse(startStr);
        var end = parse(endStr);
        var totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        var years = Math.floor(totalMonths / 12);
        var mos = totalMonths % 12;

        if (years > 0 && mos > 0) {
            return years + ' yr' + (years > 1 ? 's' : '') + ' ' + mos + ' mo' + (mos > 1 ? 's' : '');
        }
        if (years > 0) {
            return years + ' yr' + (years > 1 ? 's' : '');
        }
        return mos + ' mo' + (mos > 1 ? 's' : '');
    }

    /* ----------------------------------------------------------------------
       7. METRIC VALUE PARSING
       ---------------------------------------------------------------------- */

    function parseMetricValue(valueStr) {
        // Examples: "5+", "15+", "100M+", "10+"
        var match = valueStr.match(/^(\d+)(.*)$/);
        if (!match) return { target: 0, suffix: valueStr };
        return { target: parseInt(match[1], 10), suffix: match[2] || '' };
    }

    /* ----------------------------------------------------------------------
       8. SECTION RENDERERS
       ---------------------------------------------------------------------- */

    function renderHero(profile) {
        var container = document.getElementById('hero-content');
        if (!container) return;

        var statusClass = profile.status_available ? 'available' : 'unavailable';
        var fullName = profile.first_name + ' ' + profile.last_name;

        container.innerHTML =
            '<p class="hero-greeting">Hi, I\'m</p>' +
            '<h1 class="hero-name"><span class="typing-text">' + escapeHTML(fullName) + '</span></h1>' +
            '<div class="hero-title">' +
                '<img class="logo-img" src="/static/images/gold-logo-transparent-bg.PNG" alt="logo">' +
                '<span class="title-text">' + escapeHTML(profile.title) + '</span>' +
            '</div>' +
            '<p class="hero-tagline">' + escapeHTML(profile.tagline) + '</p>' +
            '<div class="status-badge ' + statusClass + '">' +
                '<span class="status-dot"></span>' +
                escapeHTML(profile.status) +
            '</div>';

        // Trigger typing animation after a short delay
        requestAnimationFrame(function () {
            var typingEl = container.querySelector('.typing-text');
            if (typingEl) {
                typingEl.style.display = 'inline-block';
                typingEl.style.overflow = 'hidden';
                typingEl.style.whiteSpace = 'nowrap';
                typingEl.style.borderRight = '3px solid var(--accent)';
                typingEl.style.width = '0';
                typingEl.style.animation = 'typing 1.8s steps(40, end) forwards, blink 0.75s step-end infinite';
            }
        });
    }

    function renderMetrics(metrics) {
        var container = document.getElementById('metrics-content');
        if (!container) return;

        var html = '';
        metrics.forEach(function (m) {
            var parsed = parseMetricValue(m.value);
            html +=
                '<div class="metric-card animate-on-scroll">' +
                    '<div class="metric-value" data-target="' + parsed.target + '" data-suffix="' + escapeHTML(parsed.suffix) + '">0</div>' +
                    '<div class="metric-label">' + escapeHTML(m.label) + '</div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderAbout(about) {
        var container = document.getElementById('about-content');
        if (!container) return;

        container.innerHTML =
            '<div class="about-text-col"><h3 class="about-col-title">About Me</h3><div class="about-text">' + about.about_me + '</div></div>' +
            '<div class="about-logo-col"><h3 class="about-col-title">The Logo</h3><div class="about-text">' + about.about_logo + '</div></div>';
    }

    function renderSkills(skills) {
        var container = document.getElementById('skills-content');
        if (!container) return;

        var html = '';
        skills.skills.forEach(function (s) {
            html +=
                '<div class="skill-item">' +
                    '<div class="skill-header">' +
                        '<span class="skill-name">' + escapeHTML(s.name) + '</span>' +
                        '<span class="skill-percentage">' + s.percentage + '%</span>' +
                    '</div>' +
                    '<div class="skill-bar">' +
                        '<div class="skill-fill" style="--skill-width: ' + s.percentage + '%" data-width="' + s.percentage + '"></div>' +
                    '</div>' +
                '</div>';
        });
        html += '<p class="skills-note">' + escapeHTML(skills.note) + '</p>';
        container.innerHTML = html;
    }

    function renderServices(services) {
        var container = document.getElementById('services-content');
        if (!container) return;

        var html = '';
        services.forEach(function (s, i) {
            html +=
                '<div class="service-card animate-on-scroll" style="animation-delay: ' + (i * 0.1) + 's">' +
                    '<div class="service-icon">' + getServiceIcon(s.icon) + '</div>' +
                    '<h3 class="service-title">' + escapeHTML(s.title) + '</h3>' +
                    '<p class="service-description">' + escapeHTML(s.description) + '</p>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderProjects(projects) {
        var container = document.getElementById('projects-content');
        if (!container) return;

        var html = '';
        projects.forEach(function (p, i) {
            var cardClasses = 'project-card' + (p.nda ? ' nda' : '') + ' animate-on-scroll';
            var clickAttr = (p.link && !p.nda)
                ? ' onclick="window.open(\'' + escapeHTML(p.link) + '\', \'_blank\')"'
                : '';

            var tagsHtml = '';
            p.tags.forEach(function (tag) {
                var hue = tagHue(tag);
                tagsHtml +=
                    '<span class="project-tag" style="background: hsla(' + hue + ', 70%, 50%, var(--tag-bg-alpha)); color: hsla(' + hue + ', 70%, 70%, var(--tag-text-alpha));">' +
                        escapeHTML(tag) +
                    '</span>';
            });

            var bottomHtml = p.nda
                ? '<span class="nda-badge">NDA</span>'
                : (p.link
                    ? '<a class="project-link" href="' + escapeHTML(p.link) + '" target="_blank" rel="noopener">View Project &rarr;</a>'
                    : '');

            html +=
                '<div class="' + cardClasses + '" style="animation-delay: ' + (i * 0.1) + 's"' + clickAttr + '>' +
                    '<h3 class="project-title">' + escapeHTML(p.title) + '</h3>' +
                    '<div class="project-tags">' + tagsHtml + '</div>' +
                    '<p class="project-description">' + escapeHTML(p.description) + '</p>' +
                    bottomHtml +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderExperience(experience) {
        var container = document.getElementById('experience-content');
        if (!container) return;

        var html = '';
        experience.forEach(function (e, i) {
            var duration = calculateDuration(e.start_date, e.end_date);
            html +=
                '<div class="timeline-item animate-on-scroll" style="animation-delay: ' + (i * 0.15) + 's">' +
                    '<div class="timeline-date">' + escapeHTML(e.start_date) + ' - ' + escapeHTML(e.end_date) + '</div>' +
                    '<div class="timeline-duration">' + escapeHTML(duration) + '</div>' +
                    '<div class="timeline-title">' + escapeHTML(e.title) + ' <span class="timeline-company">@ ' + escapeHTML(e.company) + '</span></div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    function renderContact(contact) {
        var container = document.getElementById('contact-content');
        if (!container) return;

        var currentTheme = getTheme();
        var ghImgSrc = currentTheme === DARK
            ? '/static/images/github-logo-dark.png'
            : '/static/images/github-logo-light.png';

        container.innerHTML =
            '<a class="contact-card animate-on-scroll" href="mailto:' + escapeHTML(contact.email) + '" style="animation-delay: 0s">' +
                '<div class="contact-icon">\u2709</div>' +
                '<div class="contact-label">Email</div>' +
                '<div class="contact-value">' + escapeHTML(contact.email) + '</div>' +
            '</a>' +
            '<a class="contact-card animate-on-scroll" href="https://' + escapeHTML(contact.github) + '" target="_blank" style="animation-delay: 0.1s">' +
                '<div class="contact-icon"><img src="' + ghImgSrc + '" alt="GitHub" id="github-icon"></div>' +
                '<div class="contact-label">GitHub</div>' +
                '<div class="contact-value">' + escapeHTML(contact.github) + '</div>' +
            '</a>' +
            '<a class="contact-card animate-on-scroll" href="https://' + escapeHTML(contact.linkedin) + '" target="_blank" style="animation-delay: 0.2s">' +
                '<div class="contact-icon"><img src="/static/images/linkedin-logo.png" alt="LinkedIn"></div>' +
                '<div class="contact-label">LinkedIn</div>' +
                '<div class="contact-value">' + escapeHTML(contact.linkedin) + '</div>' +
            '</a>';
    }

    /* ----------------------------------------------------------------------
       9. HTML ESCAPE UTILITY
       ---------------------------------------------------------------------- */

    var escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, function (ch) { return escapeMap[ch]; });
    }

    /* ----------------------------------------------------------------------
       10. SCROLL ANIMATIONS -- Intersection Observer
       ---------------------------------------------------------------------- */

    function setupScrollAnimations() {
        var animElements = document.querySelectorAll('.animate-on-scroll');
        if (!animElements.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-visible');
                    observer.unobserve(entry.target);

                    // If this is a metric card, fire count-up
                    var metricValue = entry.target.querySelector('.metric-value[data-target]');
                    if (metricValue) {
                        animateCountUp(metricValue);
                    }
                }
            });
        }, { threshold: 0.1 });

        animElements.forEach(function (el) {
            observer.observe(el);
        });

        // Skills-specific observer: animate skill bars when the skills section enters view
        var skillsSection = document.getElementById('skills');
        if (skillsSection) {
            var skillsObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var fills = entry.target.querySelectorAll('.skill-fill');
                        fills.forEach(function (fill) {
                            fill.classList.add('animate');
                            fill.style.width = fill.dataset.width + '%';
                        });
                        skillsObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            skillsObserver.observe(skillsSection);
        }
    }

    /* ----------------------------------------------------------------------
       11. COUNT-UP ANIMATION
       ---------------------------------------------------------------------- */

    function animateCountUp(element) {
        var target = parseInt(element.dataset.target, 10);
        var suffix = element.dataset.suffix || '';
        var duration = 2000;
        var start = performance.now();

        function update(now) {
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            // easeOutQuart
            var eased = 1 - Math.pow(1 - progress, 4);
            var current = Math.round(target * eased);
            element.textContent = current + suffix;
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    /* ----------------------------------------------------------------------
       12. INIT
       ---------------------------------------------------------------------- */

    async function init() {
        // Theme and navbar can run immediately
        setupThemeToggle();
        setupNavbar();

        try {
            var results = await Promise.all([
                fetchJSON('/api/profile'),
                fetchJSON('/api/metrics'),
                fetchJSON('/api/about'),
                fetchJSON('/api/skills'),
                fetchJSON('/api/services'),
                fetchJSON('/api/projects'),
                fetchJSON('/api/experience'),
                fetchJSON('/api/contact')
            ]);

            var profile    = results[0];
            var metrics    = results[1];
            var about      = results[2];
            var skills     = results[3];
            var services   = results[4];
            var projects   = results[5];
            var experience = results[6];
            var contact    = results[7];

            renderHero(profile);
            renderMetrics(metrics);
            renderAbout(about);
            renderSkills(skills);
            renderServices(services);
            renderProjects(projects);
            renderExperience(experience);
            renderContact(contact);

            setupScrollAnimations();
            setupNavHighlighting();

            var footerText = document.getElementById('footer-text');
            if (footerText) {
                footerText.textContent = profile.footer;
            }
        } catch (err) {
            console.error('Failed to load portfolio data:', err);
        }
    }

    init();
})();
