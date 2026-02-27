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

        var btn = document.getElementById('theme-toggle');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var next = getTheme() === DARK ? LIGHT : DARK;
            applyTheme(next);
        });
    }

    function runPageLoader(callback) {
        var loader = document.getElementById('page-loader');
        if (!loader) { callback(); return; }

        // Skip on repeat visits in same session
        if (sessionStorage.getItem('loaderShown')) {
            loader.remove();
            callback();
            return;
        }

        // Skip for reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            loader.remove();
            sessionStorage.setItem('loaderShown', '1');
            callback();
            return;
        }

        sessionStorage.setItem('loaderShown', '1');

        // Hide navbar off-screen so it can slide in later
        var navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.style.transform = 'translateY(-100%)';
        }

        // Measure the natural text width so the transition has an exact target
        var loaderText = loader.querySelector('.loader-text');
        var textWidth = 0;
        if (loaderText) {
            loaderText.style.width = 'auto';
            loaderText.style.position = 'absolute';
            loaderText.style.visibility = 'hidden';
            textWidth = Math.ceil(loaderText.scrollWidth) + 8;
            loaderText.style.width = '0';
            loaderText.style.position = '';
            loaderText.style.visibility = '';
        }

        var loaderBrand = loader.querySelector('.loader-brand');

        // Logo fades in (0-1000ms via CSS)
        // Text expands via transition (600-1700ms)
        // Dwell (1700-1850ms)
        // Panels split, brand stays (1850ms)
        // Brand morphs to hero position (2650ms)
        // Handoff to hero title (3050ms)
        setTimeout(function () {
            if (loaderText) {
                loaderText.style.width = textWidth + 'px';
            }
            if (loaderBrand) {
                loaderBrand.style.gap = '12px';
            }
        }, 600);

        // Remove overflow clip after text transition finishes
        setTimeout(function () {
            if (loaderText) {
                loaderText.style.overflow = 'visible';
            }
        }, 1750);

        // Fade out loader, animate brand into hero position
        setTimeout(function () {
            // Snapshot brand position
            var brandRect = loaderBrand.getBoundingClientRect();

            // Lift brand out of loader so it stays visible during fade
            loaderBrand.style.position = 'fixed';
            loaderBrand.style.left = brandRect.left + 'px';
            loaderBrand.style.top = brandRect.top + 'px';
            loaderBrand.style.zIndex = '100000';
            loaderBrand.style.margin = '0';
            document.body.appendChild(loaderBrand);

            // Render hero content behind the loader
            callback();

            // Fade out the loader background
            loader.classList.add('fade-out');

            // Double-rAF: wait for hero to render + paint before measuring
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    var slot = document.querySelector('.hero-title-slot');
                    if (!slot) return;

                    // Match slot to .hero-title box model for accurate measurement
                    slot.style.height = brandRect.height + 'px';
                    slot.style.marginTop = '8px';
                    var slotRect = slot.getBoundingClientRect();

                    // Compute movement via transform (GPU-composited)
                    var dx = (slotRect.left + slotRect.width / 2) - (brandRect.left + brandRect.width / 2);
                    var dy = slotRect.top - brandRect.top;

                    loaderBrand.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
                    loaderBrand.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';

                    // After animation completes, reparent into DOM
                    var handoffDone = false;
                    function doHandoff() {
                        if (handoffDone) return;
                        handoffDone = true;

                        // 1. Hide and kill transition BEFORE clearing position/transform
                        loaderBrand.style.visibility = 'hidden';
                        loaderBrand.style.transition = 'none';

                        // 2. Clear slot sizing
                        slot.style.height = '';
                        slot.style.marginTop = '';

                        // 3. Swap child classes
                        var lt = loaderBrand.querySelector('.loader-text');
                        if (lt) { lt.removeAttribute('style'); lt.className = 'title-text'; }
                        var ll = loaderBrand.querySelector('.loader-logo');
                        if (ll) { ll.removeAttribute('style'); ll.className = 'logo-img'; }

                        // 4. Clear brand positioning (visibility stays hidden)
                        loaderBrand.style.position = '';
                        loaderBrand.style.left = '';
                        loaderBrand.style.top = '';
                        loaderBrand.style.zIndex = '';
                        loaderBrand.style.margin = '';
                        loaderBrand.style.transform = '';
                        loaderBrand.className = 'hero-title';
                        slot.parentNode.replaceChild(loaderBrand, slot);

                        // 5. Reveal at final position next frame
                        requestAnimationFrame(function () {
                            loaderBrand.style.transition = '';
                            loaderBrand.style.visibility = '';
                        });

                        loader.remove();
                    }

                    loaderBrand.addEventListener('transitionend', function handler(e) {
                        if (e.propertyName !== 'transform') return;
                        loaderBrand.removeEventListener('transitionend', handler);
                        doHandoff();
                    });

                    // Safety fallback if transitionend doesn't fire
                    setTimeout(doHandoff, 800);
                });
            });
        }, 1850);

        // Slide navbar in from top (after loader fades + brand starts moving)
        setTimeout(function () {
            if (navbar) {
                navbar.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                navbar.style.transform = '';
                // Clean up inline styles after animation completes
                setTimeout(function () {
                    navbar.style.transition = '';
                }, 550);
            }
        }, 2450);
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
                var servicesSection = document.getElementById('metrics');
                if (servicesSection) {
                    servicesSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Navbar + scroll progress + blur intensification
        var navbar = document.getElementById('navbar');
        var scrollProgress = document.getElementById('scroll-progress');
        var heroSection = document.querySelector('.hero-section');
        var heroHeight = heroSection ? heroSection.offsetHeight : 600;
        if (heroSection) {
            window.addEventListener('resize', function () {
                heroHeight = heroSection.offsetHeight;
            }, { passive: true });
        }

        if (navbar) {
            window.addEventListener('scroll', function () {
                var scrollY = window.scrollY;

                // Scrolled class
                if (scrollY > 100) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }

                // Blur intensification (20px -> 40px over hero height)
                var blurProgress = Math.min(scrollY / heroHeight, 1);
                var blur = 20 + (blurProgress * 20);
                navbar.style.setProperty('--navbar-blur', blur + 'px');

                // Scroll progress bar
                if (scrollProgress) {
                    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                    var progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
                    scrollProgress.style.width = progress + '%';
                }
            }, { passive: true });
        }
    }

    function setupHeroParallax() {
        var heroContent = document.querySelector('.hero-section .section-content');
        var heroGlow = document.querySelector('.hero-glow');
        var heroSection = document.querySelector('.hero-section');
        if (!heroContent || !heroSection) return;

        // Skip for reduced motion or mobile
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (window.innerWidth < 768) return;

        heroContent.classList.add('hero-parallax');
        if (heroGlow) heroGlow.classList.add('hero-parallax');

        window.addEventListener('scroll', function () {
            var scrollY = window.scrollY;
            var heroHeight = heroSection.offsetHeight;

            // Only apply within hero section bounds
            if (scrollY > heroHeight) return;

            heroContent.style.transform = 'translateY(' + (scrollY * 0.4) + 'px)';
            if (heroGlow) {
                heroGlow.style.transform = 'translate(-50%, -50%) translateY(' + (scrollY * 0.7) + 'px)';
            }
        }, { passive: true });
    }

    function setupNavHighlighting() {
        var sections = document.querySelectorAll('.section[id]');
        var navLinks = document.querySelectorAll('.nav-link');

        if (!sections.length || !navLinks.length) return;

        // Map section IDs to the nav link href that should be highlighted
        var sectionToNav = {
            hero: null,
            metrics: null,
            services: '#services',
            projects: '#projects',
            about: '#about',
            experience: '#experience',
            skills: '#experience',
            contact: '#contact'
        };

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var targetHref = sectionToNav[entry.target.id];
                    navLinks.forEach(function (link) {
                        var href = link.getAttribute('href');
                        if (targetHref && href === targetHref) {
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

        // Add glow orb behind hero content
        var heroSection = document.getElementById('hero');
        if (heroSection && !heroSection.querySelector('.hero-glow')) {
            var glow = document.createElement('div');
            glow.className = 'hero-glow';
            heroSection.querySelector('.section-content').appendChild(glow);
        }

        var statusClass = profile.status_available ? 'available' : 'unavailable';
        var fullName = profile.first_name + ' ' + profile.last_name;

        // If the loader brand still exists, render a slot for it to morph into;
        // otherwise (loader skipped / hard refresh) render the title directly.
        var loaderBrand = document.querySelector('.loader-brand');
        var titleHtml = loaderBrand
            ? '<div class="hero-title-slot"></div>'
            : '<div class="hero-title">' +
                  '<img src="/static/images/gold-logo-transparent-bg.PNG" alt="freelanxur" class="logo-img" height="60">' +
                  '<span class="title-text">freelanxur</span>' +
              '</div>';

        container.innerHTML =
            '<p class="hero-greeting">Hi, I\'m</p>' +
            '<h1 class="hero-name"><span class="typing-text">' + escapeHTML(fullName) + '</span></h1>' +
            titleHtml +
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
                typingEl.style.whiteSpace = 'nowrap';
                var naturalWidth = Math.ceil(typingEl.getBoundingClientRect().width) + 1;
                typingEl.style.boxSizing = 'content-box';
                typingEl.style.setProperty('--typing-width', naturalWidth + 'px');
                typingEl.style.overflow = 'hidden';
                typingEl.style.borderRight = '3px solid var(--accent)';
                typingEl.style.width = '0';
                typingEl.style.animation = 'typing 1.8s steps(40, end) forwards, blink 0.75s step-end infinite';
            }
        });

        // Apply staggered entrance to hero children (skip title slot, brand fills it)
        var heroChildren = container.children;
        for (var i = 0; i < heroChildren.length; i++) {
            if (!heroChildren[i].classList.contains('hero-title-slot')) {
                heroChildren[i].classList.add('hero-stagger');
            }
        }

    }

    function renderMetrics(metrics) {
        var container = document.getElementById('metrics-content');
        if (!container) return;

        var html = '';
        metrics.forEach(function (m, i) {
            var parsed = parseMetricValue(m.value);
            html +=
                '<div class="metric-card glow-card animate-on-scroll" style="animation-delay: ' + (i * 0.08) + 's">' +
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
            '<div class="about-photo-col">' +
                '<img src="/static/images/profile-photo.png" alt="Rayleigh Xu" class="about-photo">' +
            '</div>' +
            '<div class="about-text-col">' +
                '<h3 class="about-subtitle">Me</h3>' +
                '<div class="about-text">' + about.about_me + '</div>' +
                '<div class="about-logo-section">' +
                    '<div class="about-logo-header">' +
                        '<h3 class="about-logo-title">The Logo</h3>' +
                        '<img src="/static/images/gold-logo-transparent-bg.PNG" alt="freelanxur logo" class="about-logo-icon">' +
                    '</div>' +
                    '<div class="about-text">' + about.about_logo + '</div>' +
                '</div>' +
            '</div>';
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
                '<div class="service-card glow-card animate-on-scroll" style="animation-delay: ' + (i * 0.1) + 's">' +
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
            var cardClasses = 'project-card glow-card' + (p.nda ? ' nda' : '') + ' animate-on-scroll';
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
        // "More on GitHub" card
        html +=
            '<a class="project-card project-card-github animate-on-scroll" href="https://github.com/rayleighxu7" target="_blank" rel="noopener" style="animation-delay: ' + (projects.length * 0.1) + 's">' +
                '<div class="github-card-inner">' +
                    '<svg class="github-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>' +
                    '<span class="github-card-text">More on GitHub</span>' +
                '</div>' +
            '</a>';
        container.innerHTML = html;
    }

    function renderExperience(experience) {
        var container = document.getElementById('experience-content');
        if (!container) return;

        var html = '';
        experience.forEach(function (e, i) {
            var duration = calculateDuration(e.start_date, e.end_date);
            html +=
                '<div class="timeline-item ' + (i % 2 === 0 ? 'slide-left' : 'slide-right') + '">' +
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
            '<a class="contact-card glow-card animate-on-scroll" href="mailto:' + escapeHTML(contact.email) + '" style="animation-delay: 0s">' +
                '<div class="contact-icon">\u2709</div>' +
                '<div class="contact-label">Email</div>' +
                '<div class="contact-value">' + escapeHTML(contact.email) + '</div>' +
            '</a>' +
            '<a class="contact-card glow-card animate-on-scroll" href="https://' + escapeHTML(contact.github) + '" target="_blank" style="animation-delay: 0.1s">' +
                '<div class="contact-icon"><img src="' + ghImgSrc + '" alt="GitHub" id="github-icon"></div>' +
                '<div class="contact-label">GitHub</div>' +
                '<div class="contact-value">' + escapeHTML(contact.github) + '</div>' +
            '</a>' +
            '<a class="contact-card glow-card animate-on-scroll" href="https://' + escapeHTML(contact.linkedin) + '" target="_blank" style="animation-delay: 0.2s">' +
                '<div class="contact-icon"><img src="/static/images/linkedin-logo.png" alt="LinkedIn"></div>' +
                '<div class="contact-label">LinkedIn</div>' +
                '<div class="contact-value">' + escapeHTML(contact.linkedin) + '</div>' +
            '</a>' +
            '<a class="contact-card glow-card animate-on-scroll" href="/api/download-cv" download style="animation-delay: 0.3s">' +
                '<div class="contact-icon">\uD83D\uDCC4</div>' +
                '<div class="contact-label">Download CV</div>' +
                '<div class="contact-value">One-page PDF</div>' +
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

    function setupTitleAnimations() {
        var titles = document.querySelectorAll('.section-title');
        if (!titles.length) return;

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('title-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        titles.forEach(function (title) {
            observer.observe(title);
        });
    }

    function setupCardGlow() {
        // Only on devices with hover capability
        if (!window.matchMedia('(hover: hover)').matches) return;

        document.addEventListener('mousemove', function (e) {
            var card = e.target.closest('.glow-card');
            if (!card) return;
            var rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
            card.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
        }, { passive: true });
    }

    function setupTimelineAnimations() {
        var timeline = document.querySelector('.timeline');
        if (!timeline) return;

        // Animate the timeline line
        var timelineObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('timeline-visible');
                    timelineObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        timelineObserver.observe(timeline);

        // Animate individual timeline items
        var items = timeline.querySelectorAll('.timeline-item');
        var itemObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('slide-visible');
                    itemObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        items.forEach(function (item, i) {
            item.style.transitionDelay = (i * 0.15) + 's';
            itemObserver.observe(item);
        });
    }

    function setupMagneticButtons() {
        if (!window.matchMedia('(hover: hover)').matches) return;

        var buttons = document.querySelectorAll('.btn');
        buttons.forEach(function (btn) {
            btn.classList.add('btn-magnetic');

            btn.addEventListener('mousemove', function (e) {
                var rect = btn.getBoundingClientRect();
                var x = e.clientX - rect.left - rect.width / 2;
                var y = e.clientY - rect.top - rect.height / 2;
                var maxMove = 4;
                var moveX = (x / rect.width) * maxMove * 2;
                var moveY = (y / rect.height) * maxMove * 2;
                btn.style.transform = 'translate(' + moveX + 'px, ' + moveY + 'px)';
            });

            btn.addEventListener('mouseleave', function () {
                btn.style.transform = '';
            });
        });
    }

    function setupBackToTop() {
        var btn = document.getElementById('back-to-top');
        var hero = document.querySelector('.hero-section');
        if (!btn || !hero) return;

        var heroHeight = hero.offsetHeight;
        window.addEventListener('resize', function () {
            heroHeight = hero.offsetHeight;
        }, { passive: true });

        window.addEventListener('scroll', function () {
            if (window.scrollY > heroHeight) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
            }
        }, { passive: true });

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ----------------------------------------------------------------------
       11. COUNT-UP ANIMATION
       ---------------------------------------------------------------------- */

    function animateCountUp(element) {
        var target = parseInt(element.dataset.target, 10);
        var suffix = element.dataset.suffix || '';
        var duration = 2000;
        var overshootDuration = duration * 0.7;
        var settleDuration = duration * 0.3;
        var overshootTarget = Math.round(target * 1.15);
        var start = performance.now();

        function update(now) {
            var elapsed = now - start;

            if (elapsed < overshootDuration) {
                // Phase 1: ramp to overshoot (115%)
                var progress = elapsed / overshootDuration;
                var eased = 1 - Math.pow(1 - progress, 3);
                var current = Math.round(overshootTarget * eased);
                element.textContent = current + suffix;
                requestAnimationFrame(update);
            } else if (elapsed < duration) {
                // Phase 2: settle from overshoot to target
                var settleProgress = (elapsed - overshootDuration) / settleDuration;
                var settleEased = settleProgress * settleProgress; // easeIn
                var current = Math.round(overshootTarget - (overshootTarget - target) * settleEased);
                element.textContent = current + suffix;
                requestAnimationFrame(update);
            } else {
                // Done — ensure exact target
                element.textContent = target + suffix;
            }
        }

        requestAnimationFrame(update);
    }

    /* ----------------------------------------------------------------------
       12. INIT
       ---------------------------------------------------------------------- */

    async function init(dataPromise) {
        // Theme and navbar can run immediately
        setupThemeToggle();
        setupNavbar();

        try {
            var results = await dataPromise;

            var profile    = results[0];
            var metrics    = results[1];
            var about      = results[2];
            var skills     = results[3];
            var services   = results[4];
            var projects   = results[5];
            var experience = results[6];
            var contact    = results[7];

            renderHero(profile);
            setupHeroParallax();
            renderMetrics(metrics);
            renderServices(services);
            renderProjects(projects);
            renderAbout(about);
            renderExperience(experience);
            renderSkills(skills);
            renderContact(contact);

            setupScrollAnimations();
            setupTitleAnimations();
            setupCardGlow();
            setupTimelineAnimations();
            setupMagneticButtons();
            setupBackToTop();
            setupNavHighlighting();

            var footerText = document.getElementById('footer-text');
            if (footerText) {
                footerText.textContent = profile.footer;
            }
        } catch (err) {
            console.error('Failed to load portfolio data:', err);
        }
    }

    // Theme must apply before loader (so loader has correct bg)
    applyTheme(getTheme());

    // Start fetching data immediately (in parallel with loader animation)
    var dataPromise = Promise.all([
        fetchJSON('/api/profile'),
        fetchJSON('/api/metrics'),
        fetchJSON('/api/about'),
        fetchJSON('/api/skills'),
        fetchJSON('/api/services'),
        fetchJSON('/api/projects'),
        fetchJSON('/api/experience'),
        fetchJSON('/api/contact')
    ]);

    runPageLoader(function () {
        init(dataPromise);
    });
})();
