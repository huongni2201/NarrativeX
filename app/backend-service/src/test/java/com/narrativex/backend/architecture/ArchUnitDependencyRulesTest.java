package com.narrativex.backend.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

@AnalyzeClasses(
    packages = "com.narrativex.backend.feature",
    importOptions = ImportOption.DoNotIncludeTests.class)
class ArchUnitDependencyRulesTest {
  @ArchTest
  static final ArchRule domain_is_framework_free =
      noClasses()
          .that()
          .resideInAnyPackage("..feature..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(
              "org.springframework..", "jakarta.persistence..", "jakarta.validation..");

  @ArchTest
  static final ArchRule domains_do_not_depend_on_other_feature_domains =
      classes()
          .that()
          .resideInAnyPackage("..feature..domain..")
          .should(new NoCrossFeatureDomainDependency());

  @ArchTest
  static final ArchRule api_uses_inbound_application_surface_only =
      noClasses()
          .that()
          .resideInAnyPackage("..feature..api..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("..infrastructure..", "..application.port.out..");

  @ArchTest
  static final ArchRule infrastructure_does_not_depend_on_delivery_adapters =
      noClasses()
          .that()
          .resideInAnyPackage("..feature..infrastructure..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("..api.controller..", "..api.request..");

  private static final class NoCrossFeatureDomainDependency extends ArchCondition<JavaClass> {
    private NoCrossFeatureDomainDependency() {
      super("not depend on a different feature's domain");
    }

    @Override
    public void check(JavaClass item, ConditionEvents events) {
      String sourceFeature = featureOf(item.getPackageName());
      if ("common".equals(sourceFeature)) {
        return;
      }
      for (Dependency dependency : item.getDirectDependenciesFromSelf()) {
        JavaClass target = dependency.getTargetClass();
        if (target.getPackageName().contains(".domain.")
            && target.getPackageName().startsWith("com.narrativex.backend.feature.")) {
          String targetFeature = featureOf(target.getPackageName());
          if (!"common".equals(targetFeature) && !sourceFeature.equals(targetFeature)) {
            events.add(
                new SimpleConditionEvent(
                    dependency, false, item.getName() + " depends on " + target.getName()));
          }
        }
      }
    }

    private static String featureOf(String packageName) {
      String prefix = "com.narrativex.backend.feature.";
      String rest =
          packageName.startsWith(prefix) ? packageName.substring(prefix.length()) : packageName;
      int separator = rest.indexOf('.');
      return separator < 0 ? rest : rest.substring(0, separator);
    }
  }
}
